"use client"

import { FileText } from "lucide-react"

import GenericFileCard from "./GenericFileCard"

interface PdfCardProps {
  name: string
  size?: number
  url?: string
  onDelete?: () => void
}

export default function PdfCard({ name, size, url, onDelete }: PdfCardProps) {
  return (
    <GenericFileCard
      name={name}
      size={size}
      url={url}
      badge="PDF"
      icon={<FileText size={18} className="text-error" />}
      onDelete={onDelete}
      downloadLabel="열기"
    />
  )
}
