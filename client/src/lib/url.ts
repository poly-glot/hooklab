export function getWebhookUrl(endpointId: string): string {
  return `${window.location.origin}/w/${endpointId}`;
}
