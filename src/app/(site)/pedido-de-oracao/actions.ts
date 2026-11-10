"use server";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { submitPrayer } from "@/server/prayer";
import { checkRate, RateLimitError } from "@/server/ratelimit";

export async function enviarPedido(fd: FormData) {
  try {
    await checkRate("oracao", 5, 3600);
    await submitPrayer(db, {
      firstName: String(fd.get("nome") ?? ""), intention: String(fd.get("intencao") ?? ""),
      wantsContact: fd.get("contato_ok") === "on", contact: String(fd.get("contato") ?? ""),
    });
  } catch (e) {
    // Nunca registrar o texto da intenção em logs.
    redirect(`/pedido-de-oracao?erro=${e instanceof RateLimitError ? "limite" : "invalido"}`);
  }
  redirect("/pedido-de-oracao?enviado=1");
}
