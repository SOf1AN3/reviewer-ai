import { NextResponse } from "next/server";
import { extractText } from "unpdf";
import mammoth from "mammoth";
import { auth } from "@/lib/auth";
import { cleanLatexText } from "@/lib/latex-clean";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const ACCEPTED_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/plain": "txt",
  "text/markdown": "md",
  "application/x-tex": "tex",
  "text/x-tex": "tex",
  "application/octet-stream": "auto",
};

function detectType(file: File): string {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "pdf";
  if (ext === "docx") return "docx";
  if (ext === "tex") return "tex";
  if (ext === "txt" || ext === "md") return ext;
  return ACCEPTED_TYPES[file.type] ?? "auto";
}

export const POST = auth(async (req) => {
  if (!req.auth?.user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Le fichier dépasse la taille maximale de 10 Mo" },
        { status: 400 }
      );
    }

    const fileType = detectType(file);
    const buffer = Buffer.from(await file.arrayBuffer());
    let text: string;

    switch (fileType) {
      case "pdf": {
        const result = await extractText(new Uint8Array(buffer), { mergePages: true });
        text = result.text;
        break;
      }
      case "docx": {
        const result = await mammoth.extractRawText({ buffer });
        text = result.value;
        break;
      }
      case "tex": {
        const raw = buffer.toString("utf-8");
        text = cleanLatexText(raw);
        break;
      }
      case "txt":
      case "md": {
        text = buffer.toString("utf-8");
        break;
      }
      default: {
        return NextResponse.json(
          { error: "Format de fichier non supporté. Utilisez .pdf, .docx, .tex, .txt ou .md" },
          { status: 400 }
        );
      }
    }

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: "Le fichier ne contient aucun texte extractible" },
        { status: 400 }
      );
    }

    return NextResponse.json({ text });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la lecture du fichier" },
      { status: 500 }
    );
  }
});
