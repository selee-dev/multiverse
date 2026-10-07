package kr.co.herob.board.service;

/** 계정 소유권과 화면 표시 필드를 담는 캐릭터 응답 모델입니다. */
public record HeroCharacter(
    String id,
    String ownerId,
    String n,
    String g,
    String t,
    String u,
    String c,
    String l,
    boolean accountCharacter
) {}