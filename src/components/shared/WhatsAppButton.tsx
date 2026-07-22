import { MessageCircle } from "lucide-react";
import { whatsappLink, cn } from "@/lib/utils";

export function WhatsAppButton({
  phone,
  message,
  label = "WhatsApp",
  className,
}: {
  phone: string | null | undefined;
  message?: string;
  label?: string;
  className?: string;
}) {
  if (!phone) return null;

  return (
    <a
      href={whatsappLink(phone, message)}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 transition",
        className
      )}
    >
      <MessageCircle className="h-3.5 w-3.5" />
      {label}
    </a>
  );
}
