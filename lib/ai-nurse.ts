import { Mistral } from '@mistralai/mistralai'

const mistral = process.env.MISTRAL_API_KEY ? new Mistral({ apiKey: process.env.MISTRAL_API_KEY }) : null

/** Short, supportive AI Nurse reply — educational only, not diagnostic. */
export async function generateAiNurseReply(input: {
  patientName: string
  condition: string
  userMessage: string
  wearableSummary: string
}): Promise<string> {
  const { patientName, condition, userMessage, wearableSummary } = input

  if (!mistral) {
    return [
      `Hi ${patientName.split(' ')[0] || 'there'} — I'm your TempoHealth AI Nurse companion.`,
      `You asked: "${userMessage.slice(0, 200)}${userMessage.length > 200 ? '…' : ''}"`,
      `Wearable summary: ${wearableSummary}`,
      `General reminders: keep taking medications as prescribed, and contact your care team about chest pain, severe shortness of breath, fainting, or other urgent symptoms.`,
      `Educational support only — not a diagnosis. Your clinician makes clinical decisions.`,
    ].join('\n\n')
  }

  try {
    const intake =
      userMessage.startsWith('[Structured intake]') ?
        '\nThis is STRUCTURED INTAKE mode: ask ONE focused follow-up question first if needed, then give brief educational framing tied to the wearable summary. Keep answers concise.'
      : ''

    const prompt = `You are "TempoHealth AI Nurse", a warm, concise virtual nurse assistant in a clinician-supervised remote monitoring program for patient "${patientName}" with "${condition}".

User message: ${userMessage}

Wearable summary (internal): ${wearableSummary}
${intake}

Reply in under 180 words. Use short paragraphs. Be supportive and educational. Never diagnose or prescribe. Encourage contacting their clinician for clinical decisions. Mention red-flag symptoms briefly (chest pain, severe breathlessness, fainting, stroke signs). End with: "[Educational only — not medical advice]"`

    const response = await mistral.chat.complete({
      model: 'mistral-large-latest',
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 280,
      temperature: 0.35,
    })

    return (
      (response.choices?.[0]?.message?.content as string)?.trim() ||
      'I could not generate a reply right now. Please try again or message your care team.'
    )
  } catch {
    return [
      `Hi ${patientName.split(' ')[0] || 'there'} — your AI Nurse hit a temporary model error.`,
      `You asked: "${userMessage.slice(0, 200)}${userMessage.length > 200 ? '…' : ''}"`,
      `Wearable summary: ${wearableSummary}`,
      `Please try again shortly, or contact your care team for urgent concerns.`,
      `[Educational only — not medical advice]`,
    ].join('\n\n')
  }
}
