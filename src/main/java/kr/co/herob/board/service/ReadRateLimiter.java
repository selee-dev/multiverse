package kr.co.herob.board.service;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Service;

/** 키별 호출 시각을 메모리에 기록해 일정 시간 안의 조회 횟수를 제한합니다. */
@Service
public class ReadRateLimiter {

    private static final int MAX_KEYS = 10_000;

    private final ConcurrentHashMap<String, Deque<Long>> calls = new ConcurrentHashMap<>();

    /** 최근 windowMs 동안 max회 미만이면 호출을 기록하고 true, 한도를 넘었으면 false를 반환합니다. */
    public boolean allow(String key, int max, long windowMs) {
        long now = System.currentTimeMillis();
        if (calls.size() > MAX_KEYS) calls.clear();
        Deque<Long> times = calls.computeIfAbsent(key, k -> new ArrayDeque<>());
        synchronized (times) {
            while (!times.isEmpty() && now - times.peekFirst() >= windowMs) times.pollFirst();
            if (times.size() >= max) return false;
            times.addLast(now);
            return true;
        }
    }
}
