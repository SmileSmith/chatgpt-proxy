/* eslint-disable import/prefer-default-export */

export interface ProxyReturn {
  id?: string;
  conversationId?: string;
  text: string;
}

export function formatReturn(result: ProxyReturn): string {
  return `data: ${JSON.stringify({
    id: result.id,
    conversationId: result.conversationId,
    text: result.text,
  })}\n\n`;
}
