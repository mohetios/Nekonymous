import { DurableObject } from "cloudflare:workers";
import type { Environment, InboxMessage } from "../types";
import { generateInboxRef } from "../utils/inbox";

const INBOX_MAX_MESSAGES = 50;

const isValidEntry = (entry: InboxMessage): boolean =>
  !!entry.ref && !!entry.ticketId && !!entry.conversationId;

export class InboxDurableObject extends DurableObject<Environment> {
  async fetch(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (request.method === "POST" && pathname === "/add") {
      return this.addMessage(request);
    }
    if (request.method === "POST" && pathname === "/mark-delivered") {
      return this.markDelivered(request);
    }
    if (request.method === "GET" && pathname === "/list") {
      return this.listInbox();
    }
    if (request.method === "GET" && pathname === "/entry") {
      return this.getEntry(request);
    }
    if (request.method === "DELETE" && pathname === "/purge") {
      await this.ctx.storage.delete("inbox");
      return new Response("Inbox purged", { status: 200 });
    }

    return new Response("Not Found", { status: 404 });
  }

  private async readInbox(): Promise<InboxMessage[]> {
    return (await this.ctx.storage.get<InboxMessage[]>("inbox")) ?? [];
  }

  private async writeInbox(inbox: InboxMessage[]): Promise<void> {
    if (inbox.length === 0) {
      await this.ctx.storage.delete("inbox");
      return;
    }
    await this.ctx.storage.put("inbox", inbox);
  }

  private async addMessage(request: Request): Promise<Response> {
    const body = await request.json<InboxMessage>();
    const { ticketId, conversationId, ciphertext } = body;

    if (!ticketId || !conversationId || !ciphertext) {
      return new Response("Missing fields", { status: 400 });
    }

    const inbox = (await this.readInbox()).filter(isValidEntry);
    if (inbox.length >= INBOX_MAX_MESSAGES) {
      return new Response("Inbox full", { status: 429 });
    }

    inbox.push({
      ref: generateInboxRef(),
      ticketId,
      conversationId,
      ciphertext,
    });

    await this.writeInbox(inbox);
    const pendingCount = inbox.filter((entry) => !entry.delivered).length;
    return Response.json({ pendingCount });
  }

  private async listInbox(): Promise<Response> {
    const raw = await this.readInbox();
    const inbox = raw.filter(isValidEntry);
    if (inbox.length !== raw.length) {
      await this.writeInbox(inbox);
    }
    return Response.json(inbox.filter((entry) => !entry.delivered));
  }

  private async getEntry(request: Request): Promise<Response> {
    const ref = new URL(request.url).searchParams.get("ref");
    if (!ref) {
      return new Response("Missing ref", { status: 400 });
    }

    const entry = (await this.readInbox()).find((item) => item.ref === ref);
    return entry ? Response.json(entry) : new Response("Not found", { status: 404 });
  }

  private async markDelivered(request: Request): Promise<Response> {
    const { ref } = await request.json<Pick<InboxMessage, "ref">>();
    if (!ref) {
      return new Response("Missing ref", { status: 400 });
    }

    const inbox = await this.readInbox();
    const index = inbox.findIndex((entry) => entry.ref === ref);
    if (index === -1) {
      return new Response("Not found", { status: 404 });
    }

    inbox[index] = {
      ref: inbox[index].ref,
      ticketId: inbox[index].ticketId,
      conversationId: inbox[index].conversationId,
      delivered: true,
    };

    await this.writeInbox(inbox);
    return new Response("OK", { status: 200 });
  }
}
