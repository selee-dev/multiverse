package kr.co.herob.board;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

/** 가입·로그인, 권한 검사, 문서 저장 및 SSE API의 통합 동작을 검증합니다. */
@SpringBootTest(classes = HeroBoardApplication.class, properties = {
    "spring.datasource.url=jdbc:h2:mem:testdb;DB_CLOSE_DELAY=-1",
    "app.admin.password=admin"})
@AutoConfigureMockMvc
class DocApiTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired org.springframework.jdbc.core.JdbcTemplate jdbc;

    @Test
    void 관리자_로그인과_문서_저장_조회_삭제() throws Exception {
        MockHttpSession session = login("admin", "admin");
        mvc.perform(get("/api/me").session(session))
            .andExpect(status().isOk()).andExpect(jsonPath("$.canAnnounce").value(true));
        mvc.perform(put("/api/doc/chat/admin-notice").session(session)
                .contentType(MediaType.APPLICATION_JSON).content("{\"p\":\"admin\",\"t\":\"관리자 공지\"}"))
            .andExpect(status().isNoContent());
        mvc.perform(put("/api/doc/nicks/admin-test").session(session)
                .contentType(MediaType.APPLICATION_JSON).content("{\"n\":\"관리자 수정\"}"))
            .andExpect(status().isNoContent());
        mvc.perform(get("/api/docs").session(session))
            .andExpect(status().isOk()).andExpect(jsonPath("$.nicks.admin-test.n").value("관리자 수정"));
        mvc.perform(delete("/api/doc/nicks/admin-test").session(session)).andExpect(status().isNoContent());
        MvcResult firstAdminCharacter = mvc.perform(post("/api/characters").session(session)
                .contentType(MediaType.APPLICATION_JSON).content("{\"n\":\"Admin One\"}"))
            .andExpect(status().isCreated()).andReturn();
        MvcResult secondAdminCharacter = mvc.perform(post("/api/characters").session(session)
                .contentType(MediaType.APPLICATION_JSON).content("{\"n\":\"Admin Two\"}"))
            .andExpect(status().isCreated()).andReturn();
        String firstAdminId = json.readTree(firstAdminCharacter.getResponse().getContentAsString()).get("id").asText();
        String secondAdminId = json.readTree(secondAdminCharacter.getResponse().getContentAsString()).get("id").asText();
        mvc.perform(delete("/api/characters/" + firstAdminId).session(session)).andExpect(status().isNoContent());
        mvc.perform(delete("/api/characters/" + secondAdminId).session(session)).andExpect(status().isNoContent());
    }

    @Test
    void 일반_사용자도_사장님_등장상태를_모두에게_공유한다() throws Exception {
        MockHttpSession session = register(uniqueUser("boss-toggle"));
        mvc.perform(post("/api/boss-visit").session(session)
                .contentType(MediaType.APPLICATION_JSON).content("{\"enabled\":true}"))
            .andExpect(status().isNoContent());
        mvc.perform(get("/api/docs").session(session))
            .andExpect(status().isOk()).andExpect(jsonPath("$.cfg.main.bossVisit").value(true));
        mvc.perform(post("/api/boss-visit").session(session)
                .contentType(MediaType.APPLICATION_JSON).content("{\"enabled\":false}"))
            .andExpect(status().isNoContent());
        mvc.perform(get("/api/docs").session(session))
            .andExpect(status().isOk()).andExpect(jsonPath("$.cfg.main.bossVisit").value(false));
    }

    @Test
    void 가입_세션_캐릭터_소유권과_관리자_권한을_검사한다() throws Exception {
        String owner = uniqueUser("owner");
        MockHttpSession ownerSession = register(owner);
        mvc.perform(get("/api/me").session(ownerSession))
            .andExpect(status().isOk()).andExpect(jsonPath("$.user").value(owner))
            .andExpect(jsonPath("$.hasCharacter").value(false));

        MvcResult characterResult = mvc.perform(post("/api/characters").session(ownerSession)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"n\":\"Owner Hero\",\"g\":\"f\",\"u\":\"member\"}"))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.ownerId").value(owner)).andReturn();
        String characterId = json.readTree(characterResult.getResponse().getContentAsString()).get("id").asText();

        mvc.perform(post("/api/characters").session(ownerSession)
                .contentType(MediaType.APPLICATION_JSON).content("{\"n\":\"Second Hero\"}"))
            .andExpect(status().isConflict());
        mvc.perform(put("/api/doc/nicks/" + characterId).session(ownerSession)
                .contentType(MediaType.APPLICATION_JSON).content("{\"n\":\"Owner Edited\"}"))
            .andExpect(status().isNoContent());
        mvc.perform(put("/api/doc/health/" + characterId).session(ownerSession)
                .contentType(MediaType.APPLICATION_JSON).content("{\"value\":42}"))
            .andExpect(status().isNoContent());

        MockHttpSession otherSession = register(uniqueUser("other"));
        mvc.perform(put("/api/doc/nicks/" + characterId).session(otherSession)
                .contentType(MediaType.APPLICATION_JSON).content("{\"n\":\"Stolen\"}"))
            .andExpect(status().isForbidden());
        mvc.perform(put("/api/doc/health/" + characterId).session(otherSession)
                .contentType(MediaType.APPLICATION_JSON).content("{\"value\":1}"))
            .andExpect(status().isForbidden());
        mvc.perform(put("/api/characters/" + characterId).session(otherSession)
                .contentType(MediaType.APPLICATION_JSON).content("{\"n\":\"Stolen\"}"))
            .andExpect(status().isForbidden());
        for (String collection : java.util.List.of("meetings", "snacks", "projects")) {
            String sharedId = "other-" + collection;
            mvc.perform(put("/api/doc/" + collection + "/" + sharedId).session(otherSession)
                    .contentType(MediaType.APPLICATION_JSON).content("{\"createdBy\":\"other\"}"))
                .andExpect(status().isNoContent());
            mvc.perform(delete("/api/doc/" + collection + "/" + sharedId).session(otherSession))
                .andExpect(status().isNoContent());
        }
        mvc.perform(put("/api/doc/chat/other-chat").session(otherSession)
                .contentType(MediaType.APPLICATION_JSON).content("{\"text\":\"not allowed\"}"))
            .andExpect(status().isForbidden());

        MockHttpSession adminSession = login("admin", "admin");
        mvc.perform(put("/api/characters/" + characterId).session(adminSession)
                .contentType(MediaType.APPLICATION_JSON).content("{\"n\":\"Admin Edited\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.n").value("Admin Edited"));
        mvc.perform(delete("/api/characters/" + characterId).session(adminSession)).andExpect(status().isNoContent());
        mvc.perform(get("/api/docs").session(adminSession))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.people.main.list[*].id").value(
                org.hamcrest.Matchers.not(org.hamcrest.Matchers.hasItem(characterId))));
        mvc.perform(put("/api/doc/people/main").session(adminSession)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"list\":[{\"id\":\"char-not-created\",\"n\":\"삭제된 계정\"},{\"id\":\"p-manual\",\"n\":\"수동 멤버\"}]}"))
            .andExpect(status().isNoContent());
        mvc.perform(get("/api/docs").session(adminSession))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.people.main.list[*].id").value(
                org.hamcrest.Matchers.not(org.hamcrest.Matchers.hasItem("char-not-created"))))
            .andExpect(jsonPath("$.people.main.list[*].id").value(
                org.hamcrest.Matchers.hasItem("p-manual")));
        mvc.perform(get("/api/events").session(adminSession).accept(MediaType.TEXT_EVENT_STREAM))
            .andExpect(status().isOk());
    }

    @Test
    void 로그인실패와_권한없는_문서수정을_거부한다() throws Exception {
        mvc.perform(post("/api/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"admin\",\"password\":\"wrong\"}"))
            .andExpect(status().isUnauthorized());
        mvc.perform(put("/api/doc/nicks/u2").contentType(MediaType.APPLICATION_JSON).content("{\"n\":\"x\"}"))
            .andExpect(status().isForbidden());
    }

    @Test
    void 가입시_아이디_중복을_확인하고_대소문자를_구분하지_않는다() throws Exception {
        String username = uniqueUser("duplicate");
        register(username);
        mvc.perform(get("/api/register/username-available").param("username", username.toUpperCase()))
            .andExpect(status().isOk()).andExpect(jsonPath("$.available").value(false));
        mvc.perform(get("/api/register/username-available").param("username", uniqueUser("available")))
            .andExpect(status().isOk()).andExpect(jsonPath("$.available").value(true));
        mvc.perform(post("/api/register").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(java.util.Map.of("username", username.toUpperCase(), "password", "pass1234"))))
            .andExpect(status().isConflict());
    }

    @Test
    void 가입은_승인_전에는_로그인할_수_없고_관리자가_승인하면_로그인된다() throws Exception {
        String username = uniqueUser("pending");
        mvc.perform(post("/api/register").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(java.util.Map.of("username", username, "password", "x"))))
            .andExpect(status().isAccepted()).andExpect(jsonPath("$.status").value("PENDING"));
        String body = json.writeValueAsString(java.util.Map.of("username", username, "password", "x"));
        mvc.perform(post("/api/login").contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isForbidden());

        MockHttpSession admin = login("admin", "admin");
        mvc.perform(get("/api/admin/accounts").session(admin))
            .andExpect(status().isOk()).andExpect(jsonPath("$[?(@.username=='" + username + "')].status").value("PENDING"));
        MockHttpSession normal = register(uniqueUser("normal"));
        mvc.perform(post("/api/admin/accounts/" + username + "/approve").session(normal)).andExpect(status().isForbidden());
        mvc.perform(post("/api/admin/accounts/" + username + "/approve").session(admin)).andExpect(status().isNoContent());
        mvc.perform(post("/api/login").contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isOk());
    }

    @Test
    void 가입_거절은_대기_계정만_삭제한다() throws Exception {
        String username = uniqueUser("reject");
        mvc.perform(post("/api/register").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(java.util.Map.of("username", username, "password", "x"))))
            .andExpect(status().isAccepted());
        MockHttpSession admin = login("admin", "admin");
        mvc.perform(delete("/api/admin/accounts/" + username).session(admin)).andExpect(status().isNoContent());
        mvc.perform(delete("/api/admin/accounts/" + username).session(admin)).andExpect(status().isNotFound());
        String approved = uniqueUser("kept");
        register(approved);
        mvc.perform(delete("/api/admin/accounts/" + approved).session(admin)).andExpect(status().isNotFound());
    }

    @Test
    void 캐릭터_목록은_관리자에게만_로그인_아이디를_보여준다() throws Exception {
        String owner = uniqueUser("hidden");
        MockHttpSession session = register(owner);
        mvc.perform(post("/api/characters").session(session)
                .contentType(MediaType.APPLICATION_JSON).content("{\"n\":\"Hidden\"}"))
            .andExpect(status().isCreated());
        mvc.perform(get("/api/characters").session(session))
            .andExpect(status().isOk()).andExpect(jsonPath("$[?(@.ownerId)]").isEmpty());
        mvc.perform(get("/api/characters").session(login("admin", "admin")))
            .andExpect(status().isOk()).andExpect(jsonPath("$[?(@.ownerId=='" + owner + "')]").isNotEmpty());
    }

    @Test
    void 전체_문서_조회는_분당_한도를_넘으면_429() throws Exception {
        MockHttpSession session = register(uniqueUser("reader"));
        for (int i = 0; i < 60; i++) mvc.perform(get("/api/docs").session(session)).andExpect(status().isOk());
        mvc.perform(get("/api/docs").session(session)).andExpect(status().isTooManyRequests());
    }

    @Test
    void 공지는_팀장급만_작성하고_개인채팅은_참여자에게만_보인다() throws Exception {
        String sender = uniqueUser("sender");
        String recipient = uniqueUser("recipient");
        String outsider = uniqueUser("outsider");
        MockHttpSession senderSession = register(sender);
        MockHttpSession recipientSession = register(recipient);
        MockHttpSession outsiderSession = register(outsider);
        mvc.perform(post("/api/characters").session(recipientSession)
                .contentType(MediaType.APPLICATION_JSON).content("{\"n\":\"Recipient Hero\"}"))
            .andExpect(status().isCreated());
        mvc.perform(get("/api/chats/private/contacts").session(senderSession))
            .andExpect(status().isOk()).andExpect(jsonPath("$[*].username")
                .value(org.hamcrest.Matchers.hasItem(recipient)))
            .andExpect(jsonPath("$[*].username")
                .value(org.hamcrest.Matchers.not(org.hamcrest.Matchers.hasItem(outsider))));

        mvc.perform(put("/api/doc/chat/notice-test").session(senderSession)
                .contentType(MediaType.APPLICATION_JSON).content("{\"p\":\"sender\",\"t\":\"notice\"}"))
            .andExpect(status().isForbidden());
        MvcResult characterResult = mvc.perform(post("/api/characters").session(senderSession)
                .contentType(MediaType.APPLICATION_JSON).content("{\"n\":\"Team Lead\",\"t\":\"팀장\"}"))
            .andExpect(status().isCreated()).andReturn();
        String characterId = json.readTree(characterResult.getResponse().getContentAsString()).get("id").asText();
        mvc.perform(get("/api/me").session(senderSession))
            .andExpect(status().isOk()).andExpect(jsonPath("$.canAnnounce").value(true));
        mvc.perform(put("/api/doc/chat/notice-test").session(senderSession)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(
                    java.util.Map.of("p", characterId, "t", "공지", "at", System.currentTimeMillis()))))
            .andExpect(status().isNoContent());

        mvc.perform(post("/api/chats/private").session(senderSession).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(java.util.Map.of("recipients", java.util.List.of(recipient), "text", "개인 메시지"))))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.text").value("개인 메시지"));
        mvc.perform(get("/api/chats/private").session(senderSession))
            .andExpect(status().isOk()).andExpect(jsonPath("$[0].text").value("개인 메시지"));
        mvc.perform(get("/api/chats/private").session(recipientSession))
            .andExpect(status().isOk()).andExpect(jsonPath("$[0].text").value("개인 메시지"));
        mvc.perform(get("/api/chats/private").session(outsiderSession))
            .andExpect(status().isOk()).andExpect(jsonPath("$", org.hamcrest.Matchers.hasSize(0)));
        mvc.perform(get("/api/docs").session(outsiderSession))
            .andExpect(status().isOk()).andExpect(jsonPath("$.privateChats").doesNotExist());
    }

    @Test
    void 로그인_5회_실패하면_잠기고_성공하면_횟수가_초기화된다() throws Exception {
        String username = uniqueUser("lock");
        register(username);
        String wrong = json.writeValueAsString(java.util.Map.of("username", username, "password", "wrong"));
        for (int i = 0; i < 4; i++) {
            mvc.perform(post("/api/login").contentType(MediaType.APPLICATION_JSON).content(wrong))
                .andExpect(status().isUnauthorized());
        }
        login(username, "pass1234");
        for (int i = 0; i < 5; i++) {
            mvc.perform(post("/api/login").contentType(MediaType.APPLICATION_JSON).content(wrong))
                .andExpect(status().isUnauthorized());
        }
        mvc.perform(post("/api/login").contentType(MediaType.APPLICATION_JSON).content(wrong))
            .andExpect(status().isTooManyRequests());
        mvc.perform(post("/api/login").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(java.util.Map.of("username", username, "password", "pass1234"))))
            .andExpect(status().isTooManyRequests());
    }

    @Test
    void H2_콘솔은_기본적으로_공개되지_않는다() throws Exception {
        mvc.perform(get("/h2-console/")).andExpect(status().isForbidden());
    }

    @Test
    void 잘못된_입력은_400() throws Exception {
        MockHttpSession session = login("admin", "admin");
        mvc.perform(put("/api/doc/hacker/u3").session(session)
                .contentType(MediaType.APPLICATION_JSON).content("{}"))
            .andExpect(status().isBadRequest());
        mvc.perform(put("/api/doc/nicks/a.b").session(session)
                .contentType(MediaType.APPLICATION_JSON).content("{}"))
            .andExpect(status().isBadRequest());
        mvc.perform(put("/api/doc/nicks/u4").session(session)
                .contentType(MediaType.APPLICATION_JSON).content("[1,2]"))
            .andExpect(status().isBadRequest());
    }

    private MockHttpSession login(String username, String password) throws Exception {
        MvcResult result = mvc.perform(post("/api/login").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(java.util.Map.of("username", username, "password", password))))
            .andExpect(status().isOk()).andReturn();
        return (MockHttpSession) result.getRequest().getSession(false);
    }

    /** 가입(승인 대기) 후 관리자 승인을 DB로 반영하고 로그인한 세션을 반환합니다. */
    private MockHttpSession register(String username) throws Exception {
        mvc.perform(post("/api/register").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(java.util.Map.of("username", username, "password", "pass1234"))))
            .andExpect(status().isAccepted());
        jdbc.update("UPDATE HERO_ACCOUNT SET STATUS = 'APPROVED' WHERE USERNAME = ?", username);
        return login(username, "pass1234");
    }

    private String uniqueUser(String prefix) {
        return prefix + Long.toString(System.nanoTime(), 36);
    }
}
