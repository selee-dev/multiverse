package kr.co.herob.board.service;

/** 계정 소유권과 화면 표시 필드를 담는 캐릭터 응답 모델입니다. */
public record HeroCharacter(
    String id,
    @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL) String ownerId,
    String n,
    String g,
    String t,
    String u,
    String c,
    boolean accountCharacter
) {}