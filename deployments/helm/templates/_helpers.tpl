{{/*
Expand the name of the chart.
*/}}
{{- define "agent-harness.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "agent-harness.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "agent-harness.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "agent-harness.labels" -}}
helm.sh/chart: {{ include "agent-harness.chart" . }}
{{ include "agent-harness.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "agent-harness.selectorLabels" -}}
app.kubernetes.io/name: {{ include "agent-harness.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "agent-harness.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "agent-harness.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
PostgreSQL connection string
*/}}
{{- define "agent-harness.postgresql.connectionString" -}}
{{- printf "postgresql://%s:%s@%s:%d/%s" 
    .Values.config.storage.postgresql.username
    .Values.secrets.postgresql.password
    .Values.config.storage.postgresql.host
    (int .Values.config.storage.postgresql.port)
    .Values.config.storage.postgresql.database
-}}
{{- end }}

{{/*
Redis connection string
*/}}
{{- define "agent-harness.redis.connectionString" -}}
{{- printf "redis://:%s@%s:%d/%d"
    .Values.secrets.redis.password
    .Values.config.memory.redis.host
    (int .Values.config.memory.redis.port)
    (int .Values.config.memory.redis.db)
-}}
{{- end }}
