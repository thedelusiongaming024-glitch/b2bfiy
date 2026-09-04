import { query } from "../index";
import { matchFaq } from "./faqMatcher";
import { retrieveRelevantChunks } from "./ragEngine";
import { getAIService } from "./provider";
import { getLiveDatabaseContext } from "./databaseContext";

export interface ChatRequest {
  message: string;
  conversationId?: string;
  sessionId: string;
  userId?: string;
  userEmail?: string;
  userWhatsapp?: string;
  userName?: string;
}

export interface ChatResponse {
  answer: string;
  source: "FAQ" | "RAG" | "AI" | "HUMAN";
  conversationId: string;
  ticket?: {
    id: string;
    ticketNumber: number;
    status: string;
    question: string;
    createdAt: string;
  } | null;
}

const SYSTEM_PROMPT = `You are B2bfiy's Official AI Support & Digital Growth Assistant.
You have direct, comprehensive access to the live PostgreSQL database for B2bfiy (b2bfiy.com) — Dhaka's premier creative and digital growth agency.

YOUR CORE MANDATE:
1. STRICT WEBSITE & AGENCY TOPIC RELEVANCE:
- You ONLY answer questions and assist with matters regarding our website, our creative agency (B2bfiy), our services (Web Design & Development, Graphic Design & Branding, Video Editing & Motion Graphics, Social Media Management & Retainers), our packages and pricing, our portfolio and case studies, our delivery turnarounds and revision policies, our free consultation/audit, and our contact channels.
- If the user's message is OFF-TOPIC (i.e. unrelated to B2bfiy, our website, digital services, web development, branding, video editing, or agency growth — for example: general school math, random world trivia, unrelated coding tutorials, sports, recipes, or general knowledge):
  You MUST politely and professionally decline, stating that you are dedicated exclusively to B2bfiy's website, creative services, and packages in Dhaka, and invite them to ask about our web design, branding, video editing, packages, or free consultation.
  Respond with this polite rejection directly. DO NOT trigger support ticket creation for off-topic queries.

2. FULL LIVE DATABASE GROUNDING & ACCURACY:
- Base all agency answers strictly on the verified live database snapshot provided in your context (Site Content, Packages, Portfolio Case Studies, FAQs, and Policies).
- Speak with a warm, confident, professional, and helpful agency tone.
- Mention specific pricing (in BDT and USD), package names, delivery turnarounds, and contact methods (+880 1712-345678, hello@b2bfiy.com, /free-audit) when relevant to the user's inquiry.
- If an inquiry IS regarding B2bfiy or our website/services, but asks for something custom, bespoke, or not covered in the database (e.g. custom corporate contract terms, custom payment methods, or asking a human representative to contact them):
  Respond with:
  INSUFFICIENT_AGENCY_KNOWLEDGE: [brief note]
  This will automatically create a support ticket so our team can follow up within 24 hours.`;

export async function processUserMessage(req: ChatRequest): Promise<ChatResponse> {
  const rawText = req.message.trim();
  const sessionId = req.sessionId || `sess_${Date.now()}`;
  let userId = req.userId;
  const userEmail = req.userEmail ? req.userEmail.trim().toLowerCase() : undefined;
  const userWhatsapp = req.userWhatsapp ? req.userWhatsapp.trim() : undefined;
  const userName = req.userName ? req.userName.trim() : undefined;

  // Resolve or create user in database if email is provided
  if (userEmail) {
    try {
      const userRows = await query<{ id: string; whatsapp?: string }>(
        "SELECT id, whatsapp FROM users WHERE LOWER(email) = LOWER($1)",
        [userEmail]
      );
      if (userRows.length > 0) {
        userId = userRows[0].id;
        await query(
          `UPDATE users
           SET whatsapp = COALESCE($1, whatsapp),
               last_login_at = NOW(),
               updated_at = NOW()
           WHERE id = $2`,
          [userWhatsapp || null, userId]
        );
      } else {
        userId = userId || `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        await query(
          `INSERT INTO users (id, name, email, whatsapp, role, created_at, updated_at, last_login_at)
           VALUES ($1, $2, $3, $4, 'user', NOW(), NOW(), NOW())`,
          [userId, userName || null, userEmail, userWhatsapp || null]
        );
      }
    } catch (uErr) {
      console.warn("User auto-link notice:", uErr);
    }
  }

  // 1. Get or create conversation
  let convId = req.conversationId;
  if (convId) {
    const existing = await query<{ id: string; user_email: string | null }>(
      "SELECT id, user_email FROM conversations WHERE id = $1",
      [convId]
    );
    if (!existing || existing.length === 0) {
      convId = undefined;
    } else if (userEmail && existing[0].user_email && existing[0].user_email.toLowerCase() !== userEmail.toLowerCase()) {
      // Switched account: don't attach to another user's conversation
      convId = undefined;
    }
  }

  if (!convId) {
    convId = `conv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    await query(
      `INSERT INTO conversations (id, session_id, user_id, user_email, user_whatsapp, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
      [convId, sessionId, userId || null, userEmail || null, userWhatsapp || null]
    );
  } else {
    await query(
      `UPDATE conversations
       SET updated_at = NOW(),
           user_id = COALESCE($2, user_id),
           user_email = COALESCE($3, user_email),
           user_whatsapp = COALESCE($4, user_whatsapp)
       WHERE id = $1`,
      [convId, userId || null, userEmail || null, userWhatsapp || null]
    );
  }

  // 2. Persist user message
  const userMsgId = `msg_u_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  await query(
    `INSERT INTO messages (id, conversation_id, role, content, source, created_at)
     VALUES ($1, $2, 'user', $3, 'USER', NOW())`,
    [userMsgId, convId, rawText]
  );

  // 3. STEP 1: Fast FAQ exact / high-confidence match
  const faqResult = await matchFaq(rawText, 0.75);
  if (faqResult.matched && faqResult.answer) {
    const asstMsgId = `msg_a_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    await query(
      `INSERT INTO messages (id, conversation_id, role, content, source, created_at)
       VALUES ($1, $2, 'assistant', $3, 'FAQ', NOW())`,
      [asstMsgId, convId, faqResult.answer]
    );

    return {
      answer: faqResult.answer,
      source: "FAQ",
      conversationId: convId,
      ticket: null,
    };
  }

  // 4. STEP 2: Full Database Context + Semantic RAG Retrieval
  try {
    const dbContext = await getLiveDatabaseContext();
    const chunks = await retrieveRelevantChunks(rawText);
    
    // Combine full database snapshot with top retrieved semantic chunks
    const contextItems = [
      dbContext.compiledFullContext,
      ...chunks.map((c) => `[RELEVANT DETAIL]\n${c.content}`)
    ];

    const aiService = getAIService();
    const generatedAnswer = await aiService.generateAnswer({
      prompt: rawText,
      systemPrompt: SYSTEM_PROMPT,
      contextChunks: contextItems,
    });

    const isInsufficient =
      generatedAnswer.includes("INSUFFICIENT_AGENCY_KNOWLEDGE") ||
      generatedAnswer.includes("INSUFFICIENT_KNOWLEDGE");

    if (!isInsufficient && generatedAnswer.trim().length > 0) {
      // Determine if source was primarily FAQ or AI/RAG
      const asstMsgId = `msg_a_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      await query(
        `INSERT INTO messages (id, conversation_id, role, content, source, created_at)
         VALUES ($1, $2, 'assistant', $3, 'AI', NOW())`,
        [asstMsgId, convId, generatedAnswer]
      );

      return {
        answer: generatedAnswer,
        source: "AI",
        conversationId: convId,
        ticket: null,
      };
    }
  } catch (aiErr) {
    console.error("AI Database Context generation failed, proceeding to support fallback:", aiErr);
  }

  // 5. STEP 3: Fallback - Automatically create a human support ticket for on-topic agency questions requiring staff review
  const existingTickets = await query<{
    id: string;
    ticket_number: number;
    status: string;
    question: string;
    created_at: string;
  }>(
    `SELECT id, ticket_number, status, question, created_at
     FROM support_tickets
     WHERE conversation_id = $1 AND question = $2 AND status IN ('OPEN', 'IN_PROGRESS')
     LIMIT 1`,
    [convId, rawText]
  );

  let ticketData: {
    id: string;
    ticketNumber: number;
    status: string;
    question: string;
    createdAt: string;
  };

  if (existingTickets.length > 0) {
    const t = existingTickets[0];
    ticketData = {
      id: t.id,
      ticketNumber: t.ticket_number || 1001,
      status: t.status,
      question: t.question,
      createdAt: t.created_at,
    };
  } else {
    const ticketId = `ticket_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const insertRes = await query<{
      id: string;
      ticket_number: number;
      status: string;
      question: string;
      created_at: string;
    }>(
      `INSERT INTO support_tickets (id, session_id, conversation_id, user_id, user_email, user_whatsapp, question, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'OPEN', NOW())
       RETURNING id, ticket_number, status, question, created_at`,
      [ticketId, sessionId, convId, userId || null, userEmail || null, userWhatsapp || null, rawText]
    );
    const created = insertRes[0];
    ticketData = {
      id: created.id,
      ticketNumber: created.ticket_number || 1001,
      status: created.status,
      question: created.question,
      createdAt: created.created_at,
    };
  }

  const fallbackAnswer = `I couldn't find a direct answer to this specific inquiry in our current database.

Your question has been submitted directly to our support team. A team representative will review it and respond within 24 hours.

Ticket #${ticketData.ticketNumber}`;

  const asstMsgId = `msg_a_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  await query(
    `INSERT INTO messages (id, conversation_id, role, content, source, created_at)
     VALUES ($1, $2, 'assistant', $3, 'HUMAN', NOW())`,
    [asstMsgId, convId, fallbackAnswer]
  );

  return {
    answer: fallbackAnswer,
    source: "HUMAN",
    conversationId: convId,
    ticket: ticketData,
  };
}
