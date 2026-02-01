import { describe, it, expect } from "vitest";
import { ConversationHistory } from "./conversation.js";

describe("ConversationHistory", () => {
  it("starts empty", () => {
    const conv = new ConversationHistory();
    expect(conv.length).toBe(0);
    expect(conv.getMessages()).toEqual([]);
  });

  it("addUser creates a user message with string content", () => {
    const conv = new ConversationHistory();
    conv.addUser("list my projects");

    const msgs = conv.getMessages();
    expect(msgs).toHaveLength(1);
    expect(msgs[0].role).toBe("user");
    expect(msgs[0].content).toBe("list my projects");
  });

  it("addAssistantText creates an assistant message with string content", () => {
    const conv = new ConversationHistory();
    conv.addAssistantText("Here are your projects...");

    const msgs = conv.getMessages();
    expect(msgs).toHaveLength(1);
    expect(msgs[0].role).toBe("assistant");
    expect(msgs[0].content).toBe("Here are your projects...");
  });

  it("addAssistantBlocks creates an assistant message with block content", () => {
    const conv = new ConversationHistory();
    conv.addAssistantBlocks([
      { type: "text", text: "Let me check..." },
      { type: "tool_use", id: "call_1", name: "manage_clusters", input: { action: "list" } },
    ]);

    const msgs = conv.getMessages();
    expect(msgs).toHaveLength(1);
    expect(msgs[0].role).toBe("assistant");
    expect(Array.isArray(msgs[0].content)).toBe(true);

    const blocks = msgs[0].content as Array<{ type: string }>;
    expect(blocks).toHaveLength(2);
    expect(blocks[0].type).toBe("text");
    expect(blocks[1].type).toBe("tool_use");
  });

  it("addToolResults creates a user message with tool_result blocks", () => {
    const conv = new ConversationHistory();
    conv.addToolResults([
      { type: "tool_result", tool_use_id: "call_1", content: '{"clusters": []}' },
    ]);

    const msgs = conv.getMessages();
    expect(msgs).toHaveLength(1);
    expect(msgs[0].role).toBe("user");

    const blocks = msgs[0].content as Array<{ type: string }>;
    expect(blocks[0].type).toBe("tool_result");
  });

  it("tracks length correctly across message types", () => {
    const conv = new ConversationHistory();
    expect(conv.length).toBe(0);

    conv.addUser("hello");
    expect(conv.length).toBe(1);

    conv.addAssistantText("hi");
    expect(conv.length).toBe(2);

    conv.addAssistantBlocks([{ type: "text", text: "thinking" }]);
    expect(conv.length).toBe(3);

    conv.addToolResults([
      { type: "tool_result", tool_use_id: "x", content: "result" },
    ]);
    expect(conv.length).toBe(4);
  });

  it("getMessages returns a copy (not a reference)", () => {
    const conv = new ConversationHistory();
    conv.addUser("test");

    const msgs1 = conv.getMessages();
    const msgs2 = conv.getMessages();

    expect(msgs1).toEqual(msgs2);
    expect(msgs1).not.toBe(msgs2); // Different array instances
  });

  it("clear empties the history", () => {
    const conv = new ConversationHistory();
    conv.addUser("one");
    conv.addAssistantText("two");
    conv.addUser("three");

    expect(conv.length).toBe(3);

    conv.clear();

    expect(conv.length).toBe(0);
    expect(conv.getMessages()).toEqual([]);
  });

  it("supports a full conversation cycle", () => {
    const conv = new ConversationHistory();

    // User asks something
    conv.addUser("list my clusters");

    // Assistant calls a tool
    conv.addAssistantBlocks([
      { type: "tool_use", id: "call_1", name: "manage_clusters", input: { action: "list", params: { groupId: "g1" } } },
    ]);

    // Tool result comes back
    conv.addToolResults([
      { type: "tool_result", tool_use_id: "call_1", content: '{"results": []}' },
    ]);

    // Assistant gives final text response
    conv.addAssistantText("You have no clusters in this project.");

    const msgs = conv.getMessages();
    expect(msgs).toHaveLength(4);
    expect(msgs[0].role).toBe("user");
    expect(msgs[1].role).toBe("assistant");
    expect(msgs[2].role).toBe("user");
    expect(msgs[3].role).toBe("assistant");
  });
});
