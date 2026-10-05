"use client";

import { useState, useRef, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Send, Mic, RefreshCw, Sparkles, Star, AlertTriangle, History, MessageSquare, Lock, Crown } from "lucide-react";
import { CHATBOT_MODES } from "@/lib/constants";
import { useAuth, type ChatSession } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import Link from "next/link";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const EXAMPLES = [
  "What is the right time to trade in the market?",
  "Discuss the impact of regulatory changes",
  "Impact of geopolitical events on the crypto market?",
];

const CAPABILITIES = [
  "Discuss the correlation between NFT market trends",
  "Debate the role of stablecoins in providing stability",
  "Examine the influence of institutional investment",
];

const LIMITATIONS = [
  "It is fine-tuned on crypto and financial data",
  "The modes may help in giving a proper response",
  "Limited knowledge of world and events after 2021",
];

const PORTFOLIO_KEYWORDS = [
  "portfolio", "my holdings", "my coins", "my investment",
  "risk analysis", "my binance", "my account", "should i sell",
  "should i buy", "my position",
];

export default function ConsultancyPage() {
  return (
    <Suspense>
      <ConsultancyContent />
    </Suspense>
  );
}

function ConsultancyContent() {
  const {
    isLoggedIn, isPremium, canChat, chatCount, chatLimit,
    incrementChatCount, saveChatSession, loadChatSession, user,
  } = useAuth();

  const searchParams = useSearchParams();
  const resumeSessionId = searchParams.get("session");

  const [mode, setMode] = useState<string>(CHATBOT_MODES[1].id);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [sessionId, setSessionId] = useState(() => "session-" + Date.now());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [initialized, setInitialized] = useState(false);

  // Load resumed session
  useEffect(() => {
    if (resumeSessionId && !initialized) {
      const session = loadChatSession(resumeSessionId);
      if (session) {
        setSessionId(session.id);
        setMode(session.mode);
        setMessages(session.messages.map((m) => ({ role: m.role, content: m.content })));
      }
      setInitialized(true);
    }
  }, [resumeSessionId, loadChatSession, initialized]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const saveCurrentSession = useCallback(
    (msgs: Message[]) => {
      if (!isLoggedIn || msgs.length === 0) return;
      const session: ChatSession = {
        id: sessionId,
        title: msgs[0]?.content.slice(0, 50) || "Untitled",
        messages: msgs.map((m) => ({ ...m, timestamp: Date.now() })),
        mode,
        createdAt: Date.now(),
      };
      saveChatSession(session);
    },
    [isLoggedIn, sessionId, mode, saveChatSession]
  );

  const isPortfolioQuestion = (text: string): boolean => {
    const lower = text.toLowerCase();
    return PORTFOLIO_KEYWORDS.some((kw) => lower.includes(kw));
  };

  const sendMessage = async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || loading) return;

    if (!isLoggedIn) {
      setMessages((prev) => [
        ...prev,
        { role: "user", content: msg },
        { role: "assistant", content: "Please sign in to use the AI advisor. Go to your Profile page to get started." },
      ]);
      setInput("");
      return;
    }

    if (!canChat) {
      setMessages((prev) => [
        ...prev,
        { role: "user", content: msg },
        { role: "assistant", content: `You've reached your free limit of ${chatLimit} responses. Upgrade to Premium ($99.99/month) for unlimited AI conversations.` },
      ]);
      setInput("");
      return;
    }

    // Check for portfolio-related questions
    if (!isPremium && isPortfolioQuestion(msg)) {
      setMessages((prev) => [
        ...prev,
        { role: "user", content: msg },
        {
          role: "assistant",
          content: "Portfolio and risk analysis queries are a Premium feature. Upgrade to Premium ($99.99/month) to get personalized insights about your holdings, risk assessments, and tailored buy/sell analysis. Visit your Profile page to subscribe.",
        },
      ]);
      setInput("");
      return;
    }

    const userMessage: Message = { role: "user", content: msg };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    setChatError(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, mode, history: messages.slice(-10) }),
      });
      const data = await res.json();
      if (!res.ok || typeof data.response !== "string" || !data.response.trim()) {
        throw new Error(data.error?.message || "The AI advisor could not respond. Please try again.");
      }
      const assistantMsg: Message = {
        role: "assistant",
        content: data.response,
      };
      const updatedMessages = [...newMessages, assistantMsg];
      setMessages(updatedMessages);
      incrementChatCount();
      saveCurrentSession(updatedMessages);
    } catch (error) {
      setMessages(messages);
      setInput(msg);
      setChatError(error instanceof Error ? error.message : "The AI advisor is temporarily unavailable.");
    }
    setLoading(false);
  };

  const newDialog = () => {
    setMessages([]);
    setChatError(null);
    setSessionId("session-" + Date.now());
    // Clear the URL param
    window.history.replaceState(null, "", "/consultancy");
  };

  const chatSessions = user?.chatSessions || [];

  return (
    <div className="min-h-screen py-8 px-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-foreground mb-8">Consultancy</h1>
        {chatError && <div role="alert" className="mb-4 rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm text-danger">{chatError}</div>}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left sidebar */}
          <div className="space-y-4">
            {CHATBOT_MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={cn(
                  "w-full text-left rounded-xl p-5 border transition-colors",
                  mode === m.id ? "border-primary bg-card" : "border-border bg-card/50 hover:bg-card"
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center", mode === m.id ? "border-primary" : "border-muted-foreground")}>
                    {mode === m.id && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                  </div>
                  <h3 className="font-semibold text-foreground text-sm">{m.name}</h3>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed pl-7">{m.description}</p>
              </button>
            ))}

            {/* Chat usage */}
            {isLoggedIn && !isPremium && (
              <div className="bg-card rounded-xl border border-border p-4">
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-muted-foreground">Chat usage</span>
                  <span className="text-foreground font-medium">{chatCount}/{chatLimit}</span>
                </div>
                <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
                  <div className={cn("h-full rounded-full transition-all", chatCount >= chatLimit ? "bg-danger" : "bg-primary")}
                    style={{ width: `${Math.min((chatCount / chatLimit) * 100, 100)}%` }} />
                </div>
                {chatCount >= chatLimit && (
                  <Link href="/profile" className="flex items-center gap-1 text-xs text-primary mt-2 hover:underline">
                    <Crown className="w-3 h-3" /> Upgrade to Premium
                  </Link>
                )}
              </div>
            )}

            {!isLoggedIn && (
              <div className="bg-card rounded-xl border border-border p-4 text-center">
                <Lock className="w-5 h-5 text-muted-foreground mx-auto mb-2" />
                <p className="text-xs text-muted-foreground mb-2">Sign in for 50 free AI responses</p>
                <Link href="/profile" className="text-xs text-primary hover:underline font-medium">Sign In</Link>
              </div>
            )}

            {/* Session history */}
            {chatSessions.length > 0 && (
              <div className="bg-card rounded-xl border border-border p-4">
                <div className="flex gap-2 mb-3">
                  <button onClick={() => setShowHistory(true)}
                    className={cn("flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                      showHistory ? "bg-foreground text-background" : "bg-muted text-muted-foreground")}>
                    <History className="w-3.5 h-3.5" /> History
                  </button>
                  <button onClick={() => setShowHistory(false)}
                    className={cn("flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                      !showHistory ? "bg-foreground text-background" : "bg-muted text-muted-foreground")}>
                    <MessageSquare className="w-3.5 h-3.5" /> Main
                  </button>
                </div>
                {showHistory && (
                  <div className="space-y-1.5 max-h-60 overflow-y-auto">
                    {chatSessions.map((s) => (
                      <a
                        key={s.id}
                        href={`/consultancy?session=${s.id}`}
                        className={cn(
                          "block text-xs py-2 px-2 rounded-lg truncate transition-colors",
                          s.id === sessionId ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
                        )}
                      >
                        {s.title || "Untitled"}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Chat area */}
          <div className="lg:col-span-2 bg-card rounded-2xl border border-border flex flex-col min-h-[600px]">
            {messages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8">
                <h2 className="text-2xl font-bold text-foreground mb-1">Intellitrex Bot</h2>
                <p className="text-xs text-muted-foreground mb-8">Ver 2.0 Apr 2026</p>
                <div className="grid grid-cols-3 gap-4 w-full max-w-2xl mb-6">
                  {[
                    { icon: Sparkles, title: "Examples", items: EXAMPLES },
                    { icon: Star, title: "Capabilities", items: CAPABILITIES },
                    { icon: AlertTriangle, title: "Limitations", items: LIMITATIONS },
                  ].map((section) => {
                    const Icon = section.icon;
                    return (
                      <div key={section.title}>
                        <div className="flex flex-col items-center gap-2 mb-4">
                          <Icon className="w-5 h-5 text-muted-foreground" />
                          <h3 className="text-sm font-semibold text-foreground">{section.title}</h3>
                        </div>
                        <div className="space-y-2">
                          {section.items.map((item, i) => (
                            <button key={i} onClick={() => section.title === "Examples" && sendMessage(item)}
                              className={cn("w-full text-left text-xs p-3 rounded-lg border border-border",
                                section.title === "Examples" ? "hover:bg-muted cursor-pointer text-primary" : "text-muted-foreground cursor-default")}>
                              {item}{section.title === "Examples" && " \u2192"}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.map((msg, i) => (
                  <div key={i} className={cn("max-w-[80%] rounded-2xl p-4 text-sm leading-relaxed",
                    msg.role === "user" ? "ml-auto bg-primary text-primary-foreground" : "bg-muted text-foreground")}>
                    {msg.content}
                  </div>
                ))}
                {loading && (
                  <div className="bg-muted rounded-2xl p-4 max-w-[80%]">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" />
                      <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce [animation-delay:0.1s]" />
                      <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce [animation-delay:0.2s]" />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}

            {/* Input */}
            <div className="p-4 border-t border-border">
              <div className="flex items-center gap-2 mb-2 justify-end">
                <button onClick={newDialog} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <RefreshCw className="w-3.5 h-3.5" /> New dialog
                </button>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center bg-muted rounded-xl px-4 py-3">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                    placeholder={!isLoggedIn ? "Sign in to start chatting..." : !canChat ? "Chat limit reached. Upgrade to Premium." : "Send a message"}
                    disabled={!isLoggedIn || !canChat}
                    className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none disabled:opacity-50"
                  />
                  <button className="text-muted-foreground hover:text-foreground ml-2"><Mic className="w-4 h-4" /></button>
                  <button onClick={() => sendMessage()} disabled={!input.trim() || loading || !isLoggedIn || !canChat}
                    className="text-primary hover:text-primary/80 ml-2 disabled:opacity-50">
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
