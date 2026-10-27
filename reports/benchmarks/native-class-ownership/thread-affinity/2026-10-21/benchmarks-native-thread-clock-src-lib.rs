//! A stateless Linux CPU clock for the calling thread, separate from the production addon.
#[cfg(not(target_os = "linux"))]
compile_error!("The diagnostic thread clock requires Linux CLOCK_THREAD_CPUTIME_ID");

/// Return actual CPU time of the calling thread, including its system time.
fn read_thread_cpu_time_ms() -> std::io::Result<f64> {
    let mut time = libc::timespec {
        tv_sec: 0,
        tv_nsec: 0,
    };
    // SAFETY: time points to an initialized writable timespec; this clock accepts no other pointers.
    let status = unsafe { libc::clock_gettime(libc::CLOCK_THREAD_CPUTIME_ID, &mut time) };
    if status != 0 {
        return Err(std::io::Error::last_os_error());
    }
    Ok(time.tv_sec as f64 * 1_000.0 + time.tv_nsec as f64 / 1_000_000.0)
}

/// No persistent allocation or reference is created by reading the clock.
#[cfg(not(test))]
#[napi_derive::napi]
pub fn thread_cpu_time_ms() -> napi::Result<f64> {
    read_thread_cpu_time_ms().map_err(|error| {
        napi::Error::from_reason(format!(
            "clock_gettime(CLOCK_THREAD_CPUTIME_ID) failed: {error}"
        ))
    })
}

#[cfg(test)]
mod tests {
    use super::read_thread_cpu_time_ms;
    use std::hint::black_box;
    use std::sync::Barrier;
    use std::time::{Duration, Instant};

    #[test]
    fn thread_clock_excludes_work_performed_by_another_thread() {
        let ready = Barrier::new(2);
        std::thread::scope(|scope| {
            let worker = scope.spawn(|| {
                ready.wait();
                let start = read_thread_cpu_time_ms().unwrap();
                let wall = Instant::now();
                while read_thread_cpu_time_ms().unwrap() - start < 10.0 {
                    black_box((0_u64..1_000).sum::<u64>());
                    assert!(wall.elapsed() < Duration::from_secs(5));
                }
                read_thread_cpu_time_ms().unwrap() - start
            });
            ready.wait();
            let start = read_thread_cpu_time_ms().unwrap();
            std::thread::sleep(Duration::from_millis(40));
            let elapsed = read_thread_cpu_time_ms().unwrap() - start;
            let worker_elapsed = worker.join().unwrap();
            assert!(elapsed >= 0.0);
            assert!(
                elapsed < worker_elapsed,
                "main={elapsed}ms worker={worker_elapsed}ms"
            );
        });
    }
}
