import { MAIL_PORT } from './support';

const MAILPIT_URL = `http://127.0.0.1:${MAIL_PORT}/api/v1`;

interface SearchResult {
	messages: { ID: string }[];
}

interface Message {
	Text: string;
}

/**
 * Lists the messages Mailpit caught for one address, newest first. Strapi answers
 * `/auth/forgot-password` only once the SMTP server accepted the mail, so it is already listed.
 * @param address - The recipient.
 * @returns The message ids.
 */
export async function messagesTo(address: string): Promise<string[]> {
	const response = await fetch(`${MAILPIT_URL}/search?query=${encodeURIComponent(`to:"${address}"`)}`);
	if (!response.ok) throw new Error(`Mailpit search returned ${response.status}`);
	const result: SearchResult = await response.json();
	return result.messages.map((message) => message.ID);
}

/**
 * Reads the plain-text body of one caught message.
 * @param id - A Mailpit message id.
 * @returns The message text.
 */
export async function messageText(id: string): Promise<string> {
	const response = await fetch(`${MAILPIT_URL}/message/${id}`);
	if (!response.ok) throw new Error(`Mailpit message returned ${response.status}`);
	const message: Message = await response.json();
	return message.Text;
}
