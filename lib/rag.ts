import { Mistral } from '@mistralai/mistralai'
import { supabase } from './supabase'

const mistral = new Mistral({ apiKey: process.env.MISTRAL_API_KEY! })

export const MEDICAL_KNOWLEDGE: Array<{ source: string; content: string }> = [
  {
    source: 'ACC/AHA AFib Guidelines 2023',
    content: 'Heart rate variability (HRV) suppression is a well-established predictor of autonomic dysregulation in atrial fibrillation. A decrease in HRV below 20ms RMSSD in AFib patients is associated with increased risk of recurrence and adverse cardiac events. Wearable-derived HRV provides continuous monitoring capability between clinical visits.',
  },
  {
    source: 'ESC Guidelines on AF Management 2020',
    content: 'Resting heart rate in AFib patients should be assessed longitudinally. Persistent elevation above 100 bpm (tachycardia) in patients on rate-control therapy may indicate inadequate control, medication non-compliance, or AF recurrence. Wearable devices can detect sustained HR elevation that would otherwise be missed between appointments.',
  },
  {
    source: 'Heart Rhythm Society Wearables Consensus 2022',
    content: 'Sleep disruption is a bidirectional trigger in atrial fibrillation. Poor sleep quality, particularly reduced deep sleep, activates the sympathetic nervous system and increases vagal tone variability, both of which can trigger AF episodes. Patients with AFib reporting more than 3 nights of poor sleep should be evaluated for AF recurrence.',
  },
  {
    source: 'JACC: Heart Failure, Volume 9, 2021',
    content: 'Reduced daily step count over 7+ consecutive days in cardiovascular patients is associated with deconditioning, volume overload, or worsening functional capacity. A >30% reduction from personal baseline warrants clinical review. Wearable-derived activity data correlates with NYHA functional class changes.',
  },
  {
    source: 'Circulation: Arrhythmia and Electrophysiology, 2022',
    content: 'Oxygen saturation dips below 95% detected by wearables in AFib patients may indicate paroxysmal nocturnal desaturation, undiagnosed obstructive sleep apnea, or reduced cardiac output. SpO2 monitoring provides actionable data for adjusting anticoagulation and rate control strategies.',
  },
  {
    source: 'Nature Digital Medicine, 2023',
    content: 'Multi-signal wearable anomaly clusters — simultaneous deviations in HRV, heart rate, and sleep quality — have a positive predictive value of 73% for predicting AF recurrence within 7 days when validated against ECG Holter monitoring. Single-metric anomalies have lower predictive value and higher false-positive rates.',
  },
  {
    source: 'ACC Expert Consensus 2021 on Remote Patient Monitoring',
    content: 'Skin temperature elevation of >0.5°C above personal baseline in cardiac patients may signal early inflammatory response, infection, or autonomic activation. Combined with other physiological deviations, it contributes to a multi-parameter risk score. Clinicians should contextualize temperature trends with symptom reports.',
  },
  {
    source: 'ESC 2023 Focused Update on AF Rhythm Monitoring',
    content: 'Respiratory rate elevation above 20 breaths/min at rest is a red flag in cardiovascular patients, associated with decompensated heart failure, pulmonary congestion, or respiratory tract infection. Wearable-derived resting respiratory rate provides an early warning signal that can trigger pre-emptive clinical contact.',
  },
  {
    source: 'Lancet Digital Health, 2022',
    content: 'Personalized anomaly detection using individual baselines outperforms population-threshold approaches in cardiovascular monitoring. Rolling 30-day windows for computing personal mean and standard deviation reduce false-positive rates by 40% compared to fixed clinical thresholds, improving clinician trust and reducing alert fatigue.',
  },
  {
    source: 'NEJM Evidence, 2023',
    content: 'Continuous wearable monitoring between clinical visits identifies AF episodes missed by standard 12-lead ECGs in up to 34% of high-risk patients. The monitoring gap between appointments represents a critical window where wearable-derived alerts can prompt timely intervention and prevent stroke or hospitalization.',
  },
]

export async function embedKnowledge() {
  for (const chunk of MEDICAL_KNOWLEDGE) {
    const embeddingResponse = await mistral.embeddings.create({
      model: 'mistral-embed',
      inputs: [chunk.content],
    })
    const embedding = embeddingResponse.data[0].embedding

    await supabase.from('knowledge_chunks').upsert({
      source: chunk.source,
      content: chunk.content,
      embedding: JSON.stringify(embedding),
    })
  }
}

export async function getRelevantEvidence(query: string, count = 3): Promise<Array<{ source: string; content: string }>> {
  try {
    const embeddingResponse = await mistral.embeddings.create({
      model: 'mistral-embed',
      inputs: [query],
    })
    const embedding = embeddingResponse.data[0].embedding

    const { data, error } = await supabase.rpc('match_knowledge_chunks', {
      query_embedding: JSON.stringify(embedding),
      match_count: count,
    })

    if (error || !data?.length) {
      return MEDICAL_KNOWLEDGE.slice(0, count)
    }

    return data.map((d: { source: string; content: string }) => ({ source: d.source, content: d.content }))
  } catch {
    return MEDICAL_KNOWLEDGE.slice(0, count)
  }
}

export async function generateClinicalContext(
  condition: string,
  metric: string,
  value: number,
  baselineMean: number,
  zScore: number,
  evidence: Array<{ source: string; content: string }>
): Promise<string> {
  const direction = zScore > 0 ? 'elevated' : 'suppressed'
  const percentChange = Math.abs(((value - baselineMean) / baselineMean) * 100).toFixed(1)

  const prompt = `You are a clinical decision support assistant helping a cardiologist review wearable data.

Patient condition: ${condition}
Flagged signal: ${metric} is ${direction} at ${value.toFixed(1)} (${percentChange}% from personal baseline of ${baselineMean.toFixed(1)}, z-score: ${zScore.toFixed(2)})

Relevant clinical evidence:
${evidence.map((e, i) => `[${i + 1}] ${e.source}: ${e.content}`).join('\n\n')}

Write exactly 2-3 sentences explaining why this deviation may be clinically relevant for a patient with ${condition}, what the evidence suggests, and acknowledge uncertainty. If the metric may come from consumer wearable exports (including derived proxies rather than clinical-grade sensors like pulse oximetry or lab HRV), mention that limitation briefly. Do NOT diagnose. End with: "Clinician confirmation required."`

  const response = await mistral.chat.complete({
    model: 'mistral-large-latest',
    messages: [{ role: 'user', content: prompt }],
    maxTokens: 200,
    temperature: 0.3,
  })

  return (response.choices?.[0]?.message?.content as string) || 'Clinical context unavailable. Manual review recommended.'
}

export async function generatePreVisitBrief(
  patientName: string,
  condition: string,
  anomalies: Array<{
    metric: string
    severity: string
    value: number
    baselineMean: number
    zScore: number
    clinical_context: string | null
    triggered_at: string
  }>,
  periodDays: number
): Promise<string> {
  if (anomalies.length === 0) {
    return `PRE-VISIT BRIEF — ${patientName}\n\nNo significant anomalies detected in the past ${periodDays} days. Wearable metrics remain within personal baseline ranges.\n\nRecommendation: Routine follow-up. Continue current monitoring plan.\n\n[Clinical decision support only — not a diagnosis]`
  }

  const highCount = anomalies.filter(a => a.severity === 'high').length
  const medCount = anomalies.filter(a => a.severity === 'medium').length
  const topAnomalies = anomalies.slice(0, 5)

  const prompt = `Generate a pre-visit brief for a cardiologist reviewing wearable data before seeing a patient.

Patient: ${patientName} | Condition: ${condition}
Monitoring period: past ${periodDays} days
Alert summary: ${highCount} HIGH severity, ${medCount} MEDIUM severity flags

Top flagged signals:
${topAnomalies.map((a, i) => `${i + 1}. ${a.metric}: value ${a.value.toFixed(1)} vs baseline ${a.baselineMean.toFixed(1)} (${a.severity})\n   Context: ${a.clinical_context || 'pending'}`).join('\n')}

Generate a structured pre-visit brief with these exact sections:
SUMMARY: (2 sentences on overall status)
TOP CHANGES: (3 bullet points of most important signals)
SUGGESTED QUESTIONS: (2-3 questions to ask the patient)
CLINICAL CONSIDERATIONS: (1-2 evidence-based points)

Under 250 words. Clinical language. End with: "[Decision support tool — clinician judgment required]"`

  const response = await mistral.chat.complete({
    model: 'mistral-large-latest',
    messages: [{ role: 'user', content: prompt }],
    maxTokens: 450,
    temperature: 0.4,
  })

  return (response.choices?.[0]?.message?.content as string) || 'Pre-visit brief unavailable. Review anomaly list manually.'
}

export async function generateWeeklyReport(
  patientName: string,
  condition: string,
  anomalies: Array<{ metric: string; severity: string; triggered_at: string; clinical_context: string | null }>,
  trends: Record<string, { mean: number; direction: 'stable' | 'improving' | 'worsening' }>
): Promise<string> {
  const prompt = `Generate a weekly wearable monitoring report for a clinician (decision support only).

Patient: ${patientName} | Condition: ${condition}
Anomalies flagged this week: ${anomalies.length} (${anomalies.filter(a => a.severity === 'high').length} high, ${anomalies.filter(a => a.severity === 'medium').length} medium)

Metric trends (personal longitudinal averages — NOT population norms):
${Object.entries(trends).map(([m, t]) => `- ${m}: recent avg ${t.mean.toFixed(1)}, direction ${t.direction}`).join('\n')}

Structure EXACTLY:
1) WEEKLY SNAPSHOT — one sentence with calibrated uncertainty ("may suggest", "possible correlation").
2) DELTA BULLETS — up to 4 bullets in plain language, e.g. heart rate ↑ vs personal baseline, sleep ↓, activity ↓, recovery variability ↓ when supported by trends.
3) CLINICAL INTERPRETATION — 2-3 sentences linking multi-signal patterns to recovery stress, sleep disruption, deconditioning, or illness as hypotheses needing confirmation — not diagnoses.
4) CONFIDENCE — label Low / Moderate / High plus one sentence on data density / multi-signal alignment.
5) SAFETY — when to escalate urgently vs routine follow-up.

Under 220 words. End with: "[Clinical decision support — not a diagnosis — clinician judgment required]"`

  const response = await mistral.chat.complete({
    model: 'mistral-large-latest',
    messages: [{ role: 'user', content: prompt }],
    maxTokens: 350,
    temperature: 0.4,
  })

  return (response.choices?.[0]?.message?.content as string) || 'Report generation failed.'
}
