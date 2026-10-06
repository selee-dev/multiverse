package kr.co.herob.board.controller;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import kr.co.herob.board.service.AccountService;
import kr.co.herob.board.service.AuthService;
import kr.co.herob.board.service.DocEventService;
import kr.co.herob.board.service.DocService;
import kr.co.herob.board.service.HeroCharacter;
import kr.co.herob.board.service.LoginAttemptService;
import kr.co.herob.board.service.PositionService;
import kr.co.herob.board.service.PrivateChatService;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import com.fasterxml.jackson.databind.node.ObjectNode;

/** 화면과 클라이언트가 사용하는 인증, 캐릭터, 문서 및 실시간 이벤트 API입니다. */
@RestController
@RequestMapping("/api")
public class DocController {

    private final DocService docs;
    private final AuthService auth;
    private final AccountService accounts;
    private final AuthenticationManager authenticationManager;
    private final SecurityContextRepository contextRepository;
    private final DocEventService events;
    private final PrivateChatService privateChats;
    private final LoginAttemptService loginAttempts;
    private final PositionService positions;

    public DocController(DocService docs, AuthService auth, AccountService accounts,
                         AuthenticationManager authenticationManager, SecurityContextRepository contextRepository,
                         DocEventService events, PrivateChatService privateChats,
                         LoginAttemptService loginAttempts, PositionService positions) {
        this.loginAttempts = loginAttempts;
        this.positions = positions;
        this.docs = docs;
        this.auth = auth;
        this.accounts = accounts;
        this.authenticationManager = authenticationManager;
        this.contextRepository = contextRepository;
        this.events = events;
        this.privateChats = privateChats;
    }

    /** 현재 세션의 계정, 역할, 캐릭터와 쓰기 권한 정보를 반환합니다. */
    @GetMapping("/me")
    public Map<String, Object> me() {
        String username = auth.currentUser();
        String characterId = auth.currentCharacterId();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("user", username);
        result.put("role", auth.currentRole());
        result.put("canWrite", auth.isAdmin());
        result.put("canAnnounce", auth.canAnnounce());
        result.put("characterId", characterId);
        result.put("hasCharacter", characterId != null);
        return result;
    }

    /** 새 일반 계정을 만들고 같은 요청에서 로그인 세션을 설정합니다. */
    @PostMapping("/register")
    public ResponseEntity<Map<String, Object>> register(@RequestBody Map<String, String> payload,
                                                          HttpServletRequest request, HttpServletResponse response) {
        String username = accounts.register(payload.get("username"), payload.get("password"));
        Authentication authenticated = authenticate(username, payload.get("password"), request, response);
        return ResponseEntity.status(HttpStatus.CREATED).body(sessionInfo(authenticated));
    }

    /** 회원가입 폼에서 아이디가 이미 사용 중인지 확인합니다. */
    @GetMapping("/register/username-available")
    public Map<String, Boolean> usernameAvailable(@RequestParam String username) {
        return Map.of("available", accounts.isUsernameAvailable(username));
    }

    /** 자격 증명을 확인하고 로그인 세션을 설정합니다. */
    @PostMapping("/login")
    public Map<String, Object> login(@RequestBody Map<String, String> payload,
                                     HttpServletRequest request, HttpServletResponse response) {
        String username = payload.get("username");
        String password = payload.get("password");
        if (username == null || password == null) throw new IllegalArgumentException("아이디와 비밀번호를 입력해 주세요.");
        String key = request.getRemoteAddr() + "|" + username.trim().toLowerCase(Locale.ROOT);
        if (loginAttempts.isLocked(key)) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.");
        }
        try {
            Authentication authenticated = authenticate(username, password, request, response);
            loginAttempts.reset(key);
            return sessionInfo(authenticated);
        } catch (AuthenticationException e) {
            loginAttempts.recordFailure(key);
            throw e;
        }
    }

    /** 등록된 캐릭터 목록을 반환합니다. */
    @GetMapping("/characters")
    public List<HeroCharacter> characters() {
        return accounts.characters();
    }

    /** 관리자용 계정·캐릭터 매핑 목록을 반환합니다. */
    @GetMapping("/admin/accounts")
    public List<Map<String, Object>> adminAccounts() {
        if (!auth.isAdmin()) throw new AccessDeniedException("관리자만 계정 목록을 볼 수 있습니다.");
        return accounts.adminAccounts();
    }

    /** 관리자가 지정한 계정에 캐릭터를 추가합니다. */
    @PostMapping("/admin/characters")
    public ResponseEntity<HeroCharacter> createAdminCharacter(@RequestBody Map<String, String> payload) {
        if (!auth.isAdmin()) throw new AccessDeniedException("관리자만 캐릭터를 매핑할 수 있습니다.");
        String owner = payload.get("username");
        if (!accounts.accountExists(owner)) throw new IllegalArgumentException("계정을 찾을 수 없습니다.");
        HeroCharacter character = accounts.createCharacter(owner, true, payload);
        events.emitRefresh();
        return ResponseEntity.status(HttpStatus.CREATED).body(character);
    }

    /** 현재 사용자를 제외한 개인·그룹 채팅 가능 계정과 캐릭터 이름을 반환합니다. */
    @GetMapping("/chats/private/contacts")
    public List<Map<String, Object>> privateChatContacts() {
        return accounts.privateChatContacts(auth.currentUser());
    }

    /** 현재 계정이 참여한 개인·그룹 메시지만 조회합니다. */
    @GetMapping("/chats/private")
    public List<ObjectNode> privateMessages() {
        return privateChats.messagesFor(auth.currentUser());
    }

    /** 선택된 계정들에게 비공개 메시지를 저장하고 변경 이벤트를 보냅니다. */
    @PostMapping("/chats/private")
    public ResponseEntity<ObjectNode> sendPrivateMessage(@RequestBody Map<String, Object> payload) {
        ObjectNode message = privateChats.send(auth.currentUser(), payload.get("recipients"), payload.get("text"));
        events.emitPrivate(message);
        return ResponseEntity.status(HttpStatus.CREATED).body(message);
    }

    /** 현재 계정 소유의 캐릭터를 생성합니다. */
    @PostMapping("/characters")
    public ResponseEntity<HeroCharacter> createCharacter(@RequestBody Map<String, String> payload) {
        HeroCharacter character = accounts.createCharacter(auth.currentUser(), auth.isAdmin(), payload);
        events.emitRefresh();
        return ResponseEntity.status(HttpStatus.CREATED).body(character);
    }

    /** 캐릭터 소유자 또는 관리자가 캐릭터 정보를 수정합니다. */
    @PutMapping("/characters/{id}")
    public HeroCharacter updateCharacter(@PathVariable String id, @RequestBody Map<String, String> payload) {
        return accounts.updateCharacter(id, auth.currentUser(), auth.isAdmin(), payload);
    }

    /** 캐릭터와 연결된 문서를 삭제합니다. */
    @DeleteMapping("/characters/{id}")
    public ResponseEntity<Void> deleteCharacter(@PathVariable String id) {
        accounts.deleteCharacter(id, auth.currentUser(), auth.isAdmin());
        positions.remove(id);
        events.emitRefresh();
        return ResponseEntity.noContent().build();
    }

    /** 저장된 전체 문서를 컬렉션별 JSON 객체로 반환합니다. */
    @GetMapping("/docs")
    public JsonNode all() {
        return docs.findAll();
    }

    /** 문서 변경 알림을 구독하는 SSE 연결을 열고 정리 작업을 등록합니다. */
    @GetMapping(value = "/events", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter events() {
        SseEmitter emitter = new SseEmitter(30 * 60_000L);
        emitter.onCompletion(() -> events.remove(emitter));
        emitter.onTimeout(() -> events.remove(emitter));
        emitter.onError(e -> events.remove(emitter));
        events.add(auth.currentUser(), emitter);
        return emitter;
    }

    /** 권한을 확인한 뒤 문서를 저장하고 구독자에게 변경을 알립니다. */
    @PutMapping("/doc/{col}/{id}")
    public ResponseEntity<Void> put(@PathVariable String col, @PathVariable String id, @RequestBody JsonNode body) {
        if (!auth.canWriteDocument(col, id)) return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        docs.save(col, id, body);
        emitDocChange("set", col, id, body);
        return ResponseEntity.noContent().build();
    }

    /** 인증된 사용자가 사장님 방문 토글만 변경하고 모든 구독자에게 알립니다. */
    @PostMapping("/boss-visit")
    public ResponseEntity<Void> setBossVisit(@RequestBody Map<String, Boolean> payload) {
        Boolean enabled = payload.get("enabled");
        if (enabled == null) return ResponseEntity.badRequest().build();
        docs.setBossVisit(enabled);
        events.emitRefresh();
        return ResponseEntity.noContent().build();
    }

    /** 권한을 확인한 뒤 문서를 삭제하고 구독자에게 변경을 알립니다. */
    @DeleteMapping("/doc/{col}/{id}")
    public ResponseEntity<Void> delete(@PathVariable String col, @PathVariable String id) {
        if (!auth.canWriteDocument(col, id)) return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        docs.remove(col, id);
        emitDocChange("delete", col, id, null);
        return ResponseEntity.noContent().build();
    }

    /**
     * 문서 변경분만 구독자에게 보냅니다. people은 조회 시 캐릭터 목록과 병합되므로
     * 저장된 본문이 그대로 화면 상태가 되지 않아 전체 새로고침으로 알립니다.
     */
    private void emitDocChange(String op, String col, String id, JsonNode body) {
        if ("people".equals(col)) events.emitRefresh();
        else events.emitDoc(op, col, id, body);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> bad(IllegalArgumentException e) {
        return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
    }

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<Map<String, String>> unauthorized(AuthenticationException e) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "아이디 또는 비밀번호를 확인해 주세요."));
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, String>> forbidden(AccessDeniedException e) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "이 작업을 수행할 권한이 없습니다."));
    }

    private Authentication authenticate(String username, String password, HttpServletRequest request, HttpServletResponse response) {
        Authentication authenticated = authenticationManager.authenticate(
            new UsernamePasswordAuthenticationToken(username, password));
        request.getSession(true);
        request.changeSessionId();
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authenticated);
        SecurityContextHolder.setContext(context);
        contextRepository.saveContext(context, request, response);
        return authenticated;
    }

    private Map<String, Object> sessionInfo(Authentication authenticated) {
        String username = authenticated.getName();
        String role = authenticated.getAuthorities().stream().map(a -> a.getAuthority())
            .filter(a -> a.startsWith("ROLE_")).map(a -> a.substring(5)).findFirst().orElse("USER");
        String characterId = accounts.characterIdFor(username);
        Map<String, Object> info = new LinkedHashMap<>();
        info.put("user", username);
        info.put("role", role);
        info.put("canWrite", "ADMIN".equals(role));
        info.put("canAnnounce", auth.canAnnounce());
        info.put("characterId", characterId);
        info.put("hasCharacter", characterId != null);
        return info;
    }
}
