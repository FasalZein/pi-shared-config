# shellcheck shell=bash
# worktree-procs.sh: shared process classification for worktrees-landed and
# worktrees-idle. Source it; it defines functions only.
#
# A "service" process belongs to a per-worktree devenv process tree (for
# example the test Postgres from devenv.nix, data in .devenv/state):
#   - it has a file (or its cwd) under <worktree>/.devenv/, or
#   - it is an ancestor of such a process and its command line contains
#     "devenv" (the devenv daemon and the devenv-processes-* wrapper), or
#   - it descends from a service process (for example the session guardian).
# Every other process with its cwd or an open file inside the worktree is
# "other": the worktree is in use.
# Limitation: `devenv up` run in the foreground from a `devenv shell` makes
# that shell part of the service tree. Revisit if worktrees are reported idle
# while a devenv shell is open in them.

# wt_snapshot: take one lsof and one ps snapshot for all later classify calls.
wt_snapshot() {
  WT_LSOF=$(lsof -nP -Fpn 2>/dev/null | awk '/^p/{p=substr($0,2)} /^n\//{print p"\t"substr($0,2)}')
  WT_PS=$(ps -axo pid=,ppid=,command= | awk '{pid=$1; ppid=$2; $1=""; $2=""; sub(/^ +/,""); print pid"\t"ppid"\t"$0}')
}

# wt_classify <worktree-path>: print "services<TAB>N" (N = processes holding
# files under .devenv), then one "other<TAB>pid<TAB>command" line per process
# outside the service tree that uses the worktree.
wt_classify() {
  local wt
  wt=$(cd "$1" 2>/dev/null && pwd -P) || wt=$1
  awk -F'\t' -v wt="$wt" '
    FNR==NR { if ($1 != "") { ppid[$1]=$2; cmd[$1]=$3 }; next }
    {
      pid=$1; path=$2
      if (path==wt || index(path, wt "/")==1) {
        inside[pid]=1
        if (path==wt "/.devenv" || index(path, wt "/.devenv/")==1) hold[pid]=1
      }
    }
    END {
      for (p in hold) {
        svc[p]=1; q=ppid[p]
        while (q > 1 && (q in cmd) && cmd[q] ~ /devenv/ && !(q in svc)) { svc[q]=1; q=ppid[q] }
      }
      do {
        changed=0
        for (p in ppid) if (!(p in svc) && (ppid[p] in svc)) { svc[p]=1; changed=1 }
      } while (changed)
      n=0; for (p in hold) n++
      print "services\t" n
      for (p in inside) if (!(p in svc)) print "other\t" p "\t" cmd[p]
    }' <(printf '%s\n' "$WT_PS") <(printf '%s\n' "$WT_LSOF")
}
