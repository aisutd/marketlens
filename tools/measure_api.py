"""
MarketLens: latency and memory of the scoring API over real HTTP, against a uvicorn it starts itself.

    python tools\\measure_api.py                                   # server on this Python
    python tools\\measure_api.py --server-python <venv>\\Scripts\\python.exe   # server in the clean API venv

Starts `uvicorn api.app:app --workers 1` with OMP_NUM_THREADS=1 (as in the Dockerfile), waits for /health,
then sends N calls per case over one keep-alive connection (stdlib http.client) and reports the median and
p95 wall time per call, client side:

    /predict    a new title every call (embedding not cached)
    /rescore    a price change on a cached title (scores the original and the edited product)
    /reasons    a launch-time product and a full product (title cached)
    /what-if    20 prices (title cached)

Then the server's peak working set (Windows, psutil), the peak over the whole process since start-up, taken
as the largest over the process and its children (a venv's python.exe is a launcher that runs the real
interpreter as a child). The script needs psutil, which only the training venv has; the server doesn't.
"""
import argparse
import http.client
import json
import os
import statistics
import subprocess
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

import psutil  # noqa: E402

DEMO = {"title": "Hardside Carry On Luggage 20 Inch Spinner Wheels TSA Lock", "price": 89.99,
        "list_price": 119.99, "category": "Suitcases"}
FULL = {**DEMO, "stars": 4.5, "reviews": 1200}
TARGETS_MS = {"/predict (new title)": 200, "/rescore (price change, cached)": 150, "/what-if (20 prices)": 1500}


def p95(xs):
    return statistics.quantiles(xs, n=20, method="inclusive")[-1]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--server-python", default=sys.executable)
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("-n", type=int, default=50)
    args = ap.parse_args()

    env = {**os.environ, "OMP_NUM_THREADS": "1", "PYTHONPATH": ROOT}
    server = subprocess.Popen([args.server_python, "-m", "uvicorn", "api.app:app", "--host", "127.0.0.1",
                               "--port", str(args.port), "--workers", "1", "--log-level", "warning"],
                              cwd=ROOT, env=env)
    try:
        conn = http.client.HTTPConnection("127.0.0.1", args.port, timeout=120)

        def call(method, path, body=None):
            t = time.perf_counter()
            conn.request(method, path, body=None if body is None else json.dumps(body),
                         headers={"Content-Type": "application/json"})
            r = conn.getresponse()
            data = r.read()
            dt = time.perf_counter() - t
            if r.status != 200:
                raise SystemExit(f"{method} {path}: {r.status} {data[:300]!r}")
            return json.loads(data), dt

        t0 = time.perf_counter()
        while True:
            try:
                health, _ = call("GET", "/health")
                break
            except (ConnectionError, http.client.HTTPException, OSError):
                if server.poll() is not None:
                    raise SystemExit("server exited during start-up")
                if time.perf_counter() - t0 > 180:
                    raise SystemExit("server did not start in 180 s")
                conn.close()
                time.sleep(0.2)
        startup = time.perf_counter() - t0
        print(f"server up in {startup:.1f} s: {health}")

        n, rows = args.n, []

        def run(name, make_body, path):
            call("POST", path, make_body(-1))   # warm-up (and caches the title where the case reuses it)
            times = [call("POST", path, make_body(i))[1] * 1000 for i in range(n)]
            rows.append((name, statistics.median(times), p95(times)))
            print(f"  {name:<36} median {rows[-1][1]:7.1f} ms   p95 {rows[-1][2]:7.1f} ms", flush=True)

        print(f"{n} calls per case:")
        run("/predict (new title)", lambda i: {**DEMO, "title": f"{DEMO['title']} Model {i + 1000} Edition"},
            "/predict")
        run("/rescore (price change, cached)",
            lambda i: {"product": DEMO, "changes": {"price": round(60 + 0.5 * (i + 1), 2)}}, "/rescore")
        run("/reasons (launch-time product)", lambda i: DEMO, "/reasons")
        run("/reasons (full product)", lambda i: FULL, "/reasons")
        run("/what-if (20 prices)", lambda i: {"product": DEMO, "prices": [round(40 + 5 * k + 0.01 * (i + 1), 2)
                                                                           for k in range(20)]}, "/what-if")

        proc = psutil.Process(server.pid)
        procs = [proc] + proc.children(recursive=True)
        peaks = {p.pid: p.memory_info().peak_wset / 2**20 for p in procs}
        peak = max(peaks.values())

        print(f"\n| {'case':<36} | median ms | p95 ms | target (median) |")
        print(f"|{'-' * 38}|-----------|--------|-----------------|")
        for name, med, q in rows:
            tgt = TARGETS_MS.get(name)
            verdict = "" if tgt is None else f"< {tgt} ms {'PASS' if med < tgt else 'FAIL'}"
            print(f"| {name:<36} | {med:9.1f} | {q:6.1f} | {verdict:<15} |")
        print(f"| {'peak working set (server)':<36} | {peak:7.0f} MB        | "
              f"{'< 1024 MB ' + ('PASS' if peak < 1024 else 'FAIL'):<15} |")
        print(f"\nserver processes, peak working set MB: {peaks}; start-up {startup:.1f} s")
    finally:
        for p in psutil.Process(server.pid).children(recursive=True) if server.poll() is None else []:
            p.kill()
        server.kill()
        server.wait()


if __name__ == "__main__":
    main()
