#!/usr/bin/env python3
from __future__ import annotations

import argparse
import asyncio
import os
import sys
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import quote, urlparse, unquote


@dataclass(frozen=True)
class ParsedProxy:
    name: str
    scheme: str
    username: str
    password: str
    host: str
    port: int


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Manage codex-lb upstream proxy endpoints, per-account bindings, and unauthenticated account pruning.",
    )
    parser.add_argument("--codex-lb-dir", default=str(Path.home() / "Dev/code-forge/codex-lb"))
    parser.add_argument("--proxies-file", help="Text file with one proxy per line. Supports username:password:host:port or URL form.")
    parser.add_argument("--reset-proxies", action="store_true", help="Delete existing proxy endpoints/pools/bindings before creating proxies from --proxies-file.")
    parser.add_argument("--bind-active", action="store_true", help="Bind all active accounts evenly across available us-sticky proxy pools.")
    parser.add_argument("--bind-limit", type=int, default=None, help="Bind only the first N active accounts.")
    parser.add_argument("--prune-reauth", action="store_true", help="Delete accounts with status reauth_required, including their proxy bindings.")
    parser.add_argument("--disable-global", action="store_true", default=True, help="Keep global proxy routing disabled. Default: true.")
    parser.add_argument("--enable-global", action="store_true", help="Enable global proxy routing with the first pool as default. Not recommended.")
    parser.add_argument("--test-proxies", action="store_true", help="Connectivity-test proxies before writing them.")
    parser.add_argument("--restart", action="store_true", help="Restart launchd service dev.codex-lb.beta after changes on macOS.")
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


def load_codex_modules(codex_lb_dir: Path) -> None:
    if not codex_lb_dir.exists():
        raise SystemExit(f"codex-lb dir not found: {codex_lb_dir}")
    os.chdir(codex_lb_dir)
    sys.path.insert(0, str(codex_lb_dir))


def parse_proxy_line(line: str, index: int) -> ParsedProxy:
    raw = line.strip()
    if not raw or raw.startswith("#"):
        raise ValueError("empty")
    if "://" in raw:
        parsed = urlparse(raw)
        if parsed.scheme not in {"http", "https", "socks5", "socks5h"}:
            raise ValueError(f"unsupported scheme: {parsed.scheme}")
        if not parsed.hostname or not parsed.port:
            raise ValueError("proxy URL must include host and port")
        return ParsedProxy(
            name=f"us-sticky-{index:02d}",
            scheme=parsed.scheme,
            username=unquote(parsed.username or ""),
            password=unquote(parsed.password or ""),
            host=parsed.hostname,
            port=int(parsed.port),
        )
    username, password, host, port_raw = raw.rsplit(":", 3)
    return ParsedProxy(
        name=f"us-sticky-{index:02d}",
        scheme="http",
        username=username,
        password=password,
        host=host,
        port=int(port_raw),
    )


def load_proxies(path: str | None) -> list[ParsedProxy]:
    if not path:
        return []
    proxies: list[ParsedProxy] = []
    for line in Path(path).expanduser().read_text().splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        proxies.append(parse_proxy_line(stripped, len(proxies) + 1))
    return proxies


async def test_proxy(proxy: ParsedProxy) -> tuple[str, bool, str]:
    import aiohttp

    proxy_url = f"{proxy.scheme}://{quote(proxy.username, safe='')}:{quote(proxy.password, safe='')}@{proxy.host}:{proxy.port}"
    timeout = aiohttp.ClientTimeout(total=20)
    try:
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get("https://api.ipify.org?format=json", proxy=proxy_url) as response:
                body = await response.text()
                return proxy.name, response.status == 200, f"status={response.status} bytes={len(body)}"
    except Exception as exc:
        return proxy.name, False, type(exc).__name__


async def main() -> None:
    args = parse_args()
    codex_lb_dir = Path(args.codex_lb_dir).expanduser()
    load_codex_modules(codex_lb_dir)

    from sqlalchemy import delete, select, update
    from app.core.crypto import TokenEncryptor
    from app.db.models import Account, AccountProxyBinding, AccountStatus, DashboardSettings, ProxyEndpoint, ProxyPool, ProxyPoolMember
    from app.db.session import SessionLocal

    proxies = load_proxies(args.proxies_file)
    if args.test_proxies and proxies:
        results = await asyncio.gather(*(test_proxy(proxy) for proxy in proxies))
        for name, ok, detail in results:
            print(f"proxy_test {name} ok={ok} {detail}")
        if not all(ok for _, ok, _ in results):
            raise SystemExit("one_or_more_proxy_tests_failed")

    async with SessionLocal() as session:
        deleted_reauth = 0
        if args.prune_reauth:
            reauth_accounts = list((await session.execute(select(Account).where(Account.status == AccountStatus.REAUTH_REQUIRED))).scalars().all())
            reauth_ids = [account.id for account in reauth_accounts]
            if reauth_ids and not args.dry_run:
                await session.execute(delete(AccountProxyBinding).where(AccountProxyBinding.account_id.in_(reauth_ids)))
                await session.execute(delete(Account).where(Account.id.in_(reauth_ids)))
            deleted_reauth = len(reauth_accounts)

        created_pools: list[ProxyPool] = []
        if args.reset_proxies:
            if not proxies:
                raise SystemExit("--reset-proxies requires --proxies-file")
            if not args.dry_run:
                await session.execute(delete(AccountProxyBinding))
                await session.execute(delete(ProxyPoolMember))
                await session.execute(delete(ProxyPool))
                await session.execute(delete(ProxyEndpoint))
                await session.flush()
                encryptor = TokenEncryptor()
                for proxy in proxies:
                    endpoint = ProxyEndpoint(
                        name=proxy.name,
                        scheme=proxy.scheme,
                        host=proxy.host,
                        port=proxy.port,
                        username=proxy.username,
                        password_encrypted=encryptor.encrypt(proxy.password) if proxy.password else None,
                        is_active=True,
                    )
                    pool = ProxyPool(name=f"{proxy.name}-pool", is_active=True)
                    session.add_all([endpoint, pool])
                    await session.flush()
                    session.add(ProxyPoolMember(pool_id=pool.id, endpoint_id=endpoint.id, sort_order=0, weight=1, is_active=True))
                    created_pools.append(pool)
        else:
            created_pools = list((await session.execute(select(ProxyPool).where(ProxyPool.name.like("us-sticky-%-pool")).order_by(ProxyPool.name.asc()))).scalars().all())

        bound = 0
        if args.bind_active:
            pools = created_pools or list((await session.execute(select(ProxyPool).where(ProxyPool.name.like("us-sticky-%-pool")).order_by(ProxyPool.name.asc()))).scalars().all())
            if not pools:
                raise SystemExit("no us-sticky proxy pools found; use --reset-proxies --proxies-file first")
            accounts = list((await session.execute(select(Account).where(Account.status == AccountStatus.ACTIVE).order_by(Account.email.asc(), Account.id.asc()))).scalars().all())
            if args.bind_limit is not None:
                accounts = accounts[: args.bind_limit]
            if not args.dry_run:
                await session.execute(update(AccountProxyBinding).values(is_active=False))
                for index, account in enumerate(accounts):
                    pool = pools[index % len(pools)]
                    binding = (await session.execute(select(AccountProxyBinding).where(AccountProxyBinding.account_id == account.id).limit(1))).scalar_one_or_none()
                    if binding is None:
                        session.add(AccountProxyBinding(account_id=account.id, pool_id=pool.id, is_active=True))
                    else:
                        binding.pool_id = pool.id
                        binding.is_active = True
            bound = len(accounts)

        settings = await session.get(DashboardSettings, 1)
        if settings is not None and not args.dry_run:
            if args.enable_global:
                pools = created_pools or list((await session.execute(select(ProxyPool).where(ProxyPool.name.like("us-sticky-%-pool")).order_by(ProxyPool.name.asc()))).scalars().all())
                if not pools:
                    raise SystemExit("cannot enable global routing without a pool")
                settings.upstream_proxy_routing_enabled = True
                settings.upstream_proxy_default_pool_id = pools[0].id
            else:
                settings.upstream_proxy_routing_enabled = False
                settings.upstream_proxy_default_pool_id = None

        if not args.dry_run:
            await session.commit()

        active_bindings = list((await session.execute(select(AccountProxyBinding).where(AccountProxyBinding.is_active.is_(True)))).scalars().all())
        endpoints = list((await session.execute(select(ProxyEndpoint))).scalars().all())
        pools = list((await session.execute(select(ProxyPool))).scalars().all())
        accounts_count = (await session.execute(select(Account))).scalars().all()
        print(f"deleted_reauth_accounts={deleted_reauth}")
        print(f"proxy_endpoints={len(endpoints)}")
        print(f"proxy_pools={len(pools)}")
        print(f"active_accounts_bound={bound}")
        print(f"active_proxy_bindings={len(active_bindings)}")
        print(f"accounts_total={len(accounts_count)}")
        print(f"global_routing_enabled={bool(args.enable_global)}")
        print("secrets_printed=false")

    if args.restart:
        import subprocess

        subprocess.run(["launchctl", "kickstart", "-k", f"gui/{os.getuid()}/dev.codex-lb.beta"], check=False)


if __name__ == "__main__":
    asyncio.run(main())
