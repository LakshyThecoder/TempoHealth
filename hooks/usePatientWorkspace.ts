'use client'

import { useCallback, useEffect, useState } from 'react'
import type { ClinicalPatternInsight } from '@/lib/clinical-patterns'

export type WorkspacePatient = {
  id: string
  name: string
  age: number
  condition: string
  medications: string[]
  data_source?: string | null
  external_subject_id?: string | null
  chart_notes?: string | null
  care_status?: string | null
}

export type WorkspaceAnomaly = {
  id: string
  metric: string
  severity: 'low' | 'medium' | 'high'
  status: string
  triggered_at: string
}

export type WorkspaceReading = {
  recorded_at: string
  hr: number | null
  hrv_ms: number | null
  steps: number | null
  sleep_duration_min: number | null
}

export function usePatientWorkspace(patientId: string) {
  const [patient, setPatient] = useState<WorkspacePatient | null>(null)
  const [anomalies, setAnomalies] = useState<WorkspaceAnomaly[]>([])
  const [readings, setReadings] = useState<WorkspaceReading[]>([])
  const [patternInsight, setPatternInsight] = useState<ClinicalPatternInsight | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [pr, ar, dr, ir] = await Promise.all([
        fetch(`/api/patients?id=${patientId}`).then(r => r.json()),
        fetch(`/api/anomaly?patient_id=${patientId}`).then(r => r.json()),
        fetch(`/api/data?patient_id=${patientId}&days=30`).then(r => r.json()),
        fetch(`/api/insights?patient_id=${patientId}&days=30`).then(r => r.json()),
      ])
      if (pr.patient) setPatient(pr.patient)
      setAnomalies(ar.anomalies || [])
      setReadings(dr.readings || [])
      if (ir.insight) setPatternInsight(ir.insight)
      else setPatternInsight(null)
    } finally {
      setLoading(false)
    }
  }, [patientId])

  useEffect(() => {
    load()
  }, [load])

  return {
    patient,
    anomalies,
    readings,
    patternInsight,
    loading,
    refetch: load,
  }
}
