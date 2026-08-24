# Incident: API Error Rate Spike

Traffic up 3.5x, error rate up from <1% to 15%, latency up from 200ms to 5s, CPU at 95%, and it started 10 minutes after a deploy. That timing is too clean to ignore — that's where I'd start.

## How I'd investigate

First thing I'd do is pull up whatever monitoring is in place (Prometheus/Grafana, most likely) and line up the error-rate, latency, and CPU graphs against the deploy timestamp. If all three have a visible step-change right at rollout, that tells me almost everything I need to know before I've read a single log line.

From there, working through the stack:

- `kubectl get pods` and `kubectl get hpa` for the service — are we maxed out on replicas already? Are pods restarting or getting OOMKilled?
- `kubectl top pods` — is the CPU spread evenly across pods, or is it uneven, which would point at load-balancing weirdness rather than a genuine per-request cost problem?
- Centralized logs (whatever's aggregating them — ELK, Loki, CloudWatch, doesn't matter which) filtered to 5xx responses in the last 15 minutes, looking for stack traces, timeouts, anything unhandled.
- A distributed trace for one of the slow requests, if tracing is wired up, to see where the 5 seconds is actually being spent — inside the app's own code, or waiting on a downstream call (database, cache, another service).
- What actually shipped in that deploy — diff it. Small change or big one? Anything touching a hot code path, a database query, a loop, or logging/serialization?
- Whether the traffic increase itself is legitimate — evenly spread across normal endpoints, or hammering one route in a way that looks more like a retry storm or bot traffic than organic growth.

## What I think is causing it

My leading theory is that the deploy made something more expensive per request, and it only became visible once real load (350rps) hit it. A change that's invisible at 100rps — an inefficient query that used to hit an index and now doesn't, a synchronous/blocking operation that's fine at low concurrency, a cache that got disabled or is now missing more often, a memory leak causing heavier GC — can look completely fine in testing and then fall over hard once traffic multiplies. CPU pegged at 95% plus latency going from 200ms to 5 seconds is a classic resource-saturation signature: once a service is CPU- or connection-bound, latency doesn't degrade gracefully, it falls off a cliff, and timeouts turn into 5xx errors. If clients are retrying on top of that, it gets worse under its own weight.

I'd put "pure traffic spike, deploy is just a coincidence" as a distant second — it doesn't explain the CPU number as well on its own, and a healthy service under normal autoscaling usually degrades more gracefully than a 25x latency jump.

## How I'd confirm it

- Check whether the CPU/latency/error graphs actually start moving at the rollout timestamp, not just sometime in the last ten minutes.
- Compare CPU (or DB query time, if that's the suspect) per request before and after the deploy, not just the raw totals — if that ratio jumped even though the traffic mix looks similar, that's the new code, not new traffic.
- Reproduce it away from production: run the new build against a load test at roughly the same RPS in a staging/scratch environment and see if the same pattern shows up on its own. If it does, that's close to proof without needing a live profiler session in prod.

## How I'd mitigate it right now

Before I even have a confirmed root cause, I'd scale out — add replicas (or raise the HPA ceiling if it's already maxed) to buy breathing room while I keep digging. That's low-risk regardless of what the actual cause turns out to be.

If scaling doesn't bring the error rate down, that tells me it's not a capacity problem, it's a per-request bug — at that point I stop trying to patch it live and roll back instead.

## Would I roll back?

Yes, and quickly, given how suspicious that 10-minute window is. Rolling back a Kubernetes deployment is fast and low-risk — `kubectl rollout undo`, or reverting the tracked manifest/image tag if it's managed through GitOps — and it's a much shorter path to stopping customer impact than debugging live in production under pressure. I'd roll back first to stop the bleeding, then investigate the root cause against a now-stable production and a safe reproduction elsewhere.

The one case I wouldn't roll back immediately is if the graphs clearly show CPU and latency climbing *before* the deploy went out — if it's purely a traffic event, rolling back changes nothing, and I'd put all my effort into scaling and shedding load instead.

## How I'd stop this happening again

- A basic load/performance test in CI for anything touching a hot request path — this exact failure mode (fine at low load, falls over at higher concurrency) is precisely what unit tests never catch.
- Real alerting on error rate, latency percentiles, and CPU/saturation, not just dashboards someone has to remember to check — so this gets caught by a page within a minute or two, not by a customer noticing first.
- A post-deploy health check in the pipeline that watches error rate/latency for a few minutes after rollout and automatically rolls back if they look like this — catching it before it fully reaches users instead of after.
- Review the autoscaling ceiling — if a service can see 3x+ traffic swings, its max replica count and resource requests should have headroom for that, not just for average load.
- A canary or staged rollout, so a bad deploy only ever affects a slice of traffic before going to everyone.
