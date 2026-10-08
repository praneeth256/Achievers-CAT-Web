/**
 * One-time admin route to seed VARC "Odd One Out" TITA practice questions.
 * POST /api/admin/seed-odd-one-out
 *
 * Protected: requires CRON_SECRET in Authorization header.
 * Idempotent: checks for existing questions with chapter "Odd One Out"
 * and skips if already seeded.
 */

import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function getAdminApp(): App {
  if (getApps().length > 0) return getApps()[0];
  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

export const dynamic = "force-dynamic";

const QUESTIONS = [
  {
    question:
      "Directions: The following question consists of a set of five sentences. Out of these, four sentences can be arranged to make a coherent paragraph. One sentence doesn't belong to the paragraph. Type in that option as the odd one out.\n\n1. A friend can be any one who is there for you, be it a bad friend or a good friend, but out of all your friends there is always the better one, and this the good one.\n2. Your friend is an inveterate globe-trotter, and his letters are full of memories of other trips.\n3. He has a wry and very engaging sense of humour, he's a movie fan, he used to be quite an activist (though he was never much into 'ideology'), and he's thoughtful and very well read.\n4. Imagine getting letters from a friend in Japan, letters full of images, sounds and ideas.\n5. In his letters, he wants to share with you the faces that have caught his eye, the events that made him smile or weep, the places where he's felt at home.\n\nCorrect order: 4-2-3-5",
    correctAnswer: "1",
    explanation: "The context is about getting letters from a friend in Japan. Statement (1) says who a friend is in a general sense, so it is the odd one out.\nCorrect order: 4235",
  },
  {
    question:
      "Directions: The following question consists of a set of five sentences. Out of these, four sentences can be arranged to make a coherent paragraph. One sentence doesn't belong to the paragraph. Type in that option as the odd one out.\n\n1. For once, I can't empathize with Hollywood.\n2. In a post this week entitled \"Time to Panic: Inside the Movie Business' Summer of Hell,\" Variety detailed Hollywood's disastrous summer of 2017.\n3. So…what's on TV?\n4. And truly, the only way this summer could have been more hellacious for the industry is if they'd actually had to sit down and watch one of their own films.\n5. I mean, people: you put The Emoji Movie out into the world—a 90-minute animated star turn for the Meh face—is a lukewarm audience reaction any surprise?\n\nCorrect order: 1-2-4-5",
    correctAnswer: "3",
    explanation: "The discussion is about Hollywood/movies, specifically how bad the movies have been. 'What's on TV?' is out of place.\nCorrect order: 1245",
  },
  {
    question:
      "Directions: The following question consists of a set of five sentences. Out of these, four sentences can be arranged to make a coherent paragraph. One sentence doesn't belong to the paragraph. Type in that option as the odd one out.\n\n1. Moreover, it was a dream that revealed to a scientist the molecular structure of carbon atoms in the benzene ring.\n2. Dreams can be baffling and mysterious.\n3. All this mystery can leave us wondering what a particular dream means to the dreamer.\n4. Dreams are always \"true\"—it's just that what they mean isn't always what we think they mean.\n5. Throughout history dreams have been associated with sacred revelation and prophecy.\n\nCorrect order: 2-5-1-3",
    correctAnswer: "4",
    explanation: "Statement (4), which talks about dreams being 'true', is out of context with the flow.\nCorrect order: 2513",
  },
  {
    question:
      "Directions: The following question consists of a set of five sentences. Out of these, four sentences can be arranged to make a coherent paragraph. One sentence doesn't belong to the paragraph. Type in that option as the odd one out.\n\n1. There is no single profile for the successful chief executive.\n2. Great chief executives have a \"nose\" for what are the most significant issues, challenges, threats, and opportunities facing an organization.\n3. Others may benefit from a quieter approach, from a leader who can build relationships without appearing too \"salesy\" and who can avoid spooking relevant markets.\n4. In every case, boards will have a broad set of business conditions to assess before determining their target profile.\n5. Some companies may require a true extrovert — someone willing to trumpet the company's successes through constant and varied social gatherings.\n\nCorrect order: 1-4-5-3",
    correctAnswer: "2",
    explanation: "Statement (2) discusses one specific quality of chief executives and breaks the unity of the paragraph.\nCorrect order: 1453",
  },
  {
    question:
      "Directions: The following question consists of a set of five sentences. Out of these, four sentences can be arranged to make a coherent paragraph. One sentence doesn't belong to the paragraph. Type in that option as the odd one out.\n\n1. The turbaned Mr. Punch of Calcutta smokes a hubble-bubble while being entertained by maidens.\n2. Of all the English comic magazines of the period, 'The Indian Charivari' was the most accomplished.\n3. It appeared in 1872 with an Indian version of Richard Doyle's famous Punch cover.\n4. Caricature as a form of journalism was imported from Britain by the British in India which was initially on Anglo-Indian lifestyle, eventually turned to Indian.\n5. Although the magazine excelled in caricatures of Indians, it also resorts to share mild jokes about English social life and other topical issues.\n\nCorrect order: 2-3-5-1",
    correctAnswer: "4",
    explanation: "Statement (4) discusses caricature as a form of journalism and is the odd one out.\nCorrect order: 2351",
  },
  {
    question:
      "Directions: The following question consists of a set of five sentences. Out of these, four sentences can be arranged to make a coherent paragraph. One sentence doesn't belong to the paragraph. Type in that option as the odd one out.\n\n1. If Swapo has historically shown little interest in highlighting the colonial-era genocide, Namibia's tiny but economically powerful German-speaking minority has shown strong resistance.\n2. Six years ago, the most prominent statue of the German colonial era was toppled from a hill overlooking Windhoek, the capital.\n3. Namibia's complicated internal dynamics have contributed as well.\n4. The Herero and Nama are minorities in a nation led since independence by the liberation party, the South West Africa People's Organization, or Swapo, which is dominated by the Ovambo ethnic group.\n5. German reticence is not the only reason the reckoning has taken so long.\n\nCorrect order: 5-3-4-1",
    correctAnswer: "2",
    explanation: "Statement (2) is completely out of context.\nCorrect order: 5341",
  },
  {
    question:
      "Directions: The following question consists of a set of five sentences. Out of these, four sentences can be arranged to make a coherent paragraph. One sentence doesn't belong to the paragraph. Type in that option as the odd one out.\n\n1. Practice makes perfect.\n2. A common chef's manoeuvre: cut around the long side of the fruit down to the seed with a large knife.\n3. Cooking is a science and a chef needs to be precise.\n4. Then firmly tap the knife blade on the centre of the seed a few times until it sticks.\n5. Twist the top half off like a jar lid.\n\nCorrect order: 2-5-4-1",
    correctAnswer: "3",
    explanation: "Statement (3) is a general statement about a chef and is therefore the odd one out.\nCorrect order: 2541",
  },
  {
    question:
      "Directions: The following question consists of a set of five sentences. Out of these, four sentences can be arranged to make a coherent paragraph. One sentence doesn't belong to the paragraph. Type in that option as the odd one out.\n\n1. Originally, it only referred to coastal travel between ports, but the definition has expanded to include travel by air, railway, and by road.\n2. Let's make one thing clear: Cabotage does not mean to sabotage a taxi driver, which we do not recommend in any circumstance, just as a general tip for safe driving.\n3. So, what's the real definition?\n4. Believe it or not, this is an outdated term for \"armpit.\"\n5. It means the transport of goods and passengers between two places in the same country, or the right to do so.\n\nCorrect order: 2-3-5-1",
    correctAnswer: "4",
    explanation: "Statement (4), which discusses 'armpit', is the odd one out.\nCorrect order: 2351",
  },
  {
    question:
      "Directions: The following question consists of a set of five sentences. Out of these, four sentences can be arranged to make a coherent paragraph. One sentence doesn't belong to the paragraph. Type in that option as the odd one out.\n\n1. In 1976, the KGB tried a different tactic, forging FBI documents suggesting that hardline anti-Communist Sen. Scoop Jackson was gay, then sending them off to different newspapers in a bid to derail his campaign.\n2. In 1960 and 1968, Soviet spies reached out to Democratic candidates to offer assistance in the form of friendly propaganda or secret funding.\n3. The notion of Russia attempting to influence American elections isn't particularly new.\n4. Both of the candidates in question, Adlai Stevenson and Hubert Humphrey, turned down their offer (and went on to lose their campaigns).\n5. The Russian bid to influence the 2016 combined outreach to a potentially friendly campaign and spreading fake news with the theft of Clinton's private emails.\n\nCorrect order: 3-2-4-1",
    correctAnswer: "5",
    explanation: "Statement (5) is out of context with the historical examples being discussed.\nCorrect order: 3241",
  },
  {
    question:
      "Directions: The following question consists of a set of five sentences. Out of these, four sentences can be arranged to make a coherent paragraph. One sentence doesn't belong to the paragraph. Type in that option as the odd one out.\n\n1. It's thanks to Greenpeace supporters that we can keep putting in the hours to uncover and publish the facts.\n2. Climate change is the story of the century.\n3. As journalists, we have a responsibility to tell it right.\n4. But that takes time, resources and expertise – and we're up against a constant tide of fake news and misinformation.\n5. Greenpeace India is an independent organisation registered in India, connected to a network of other Greenpeace offices in over 55 countries.\n\nCorrect order: 2-3-4-1",
    correctAnswer: "5",
    explanation: "Statement (5) explains what Greenpeace India is, which breaks the unity of the paragraph.\nCorrect order: 2341\n\nDevelopment: 2 (X is important) → 3 (Y has responsibility for X) → 4 (challenges in executing that responsibility) → 1 (Z is helping in that regard)",
  },
];

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET ?? "";

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const app = getAdminApp();
    const db = getFirestore(app);
    const col = db.collection("practice_questions");

    // Check if already seeded
    const existing = await col
      .where("chapter", "==", "Odd One Out")
      .limit(1)
      .get();

    if (!existing.empty) {
      return NextResponse.json({
        ok: true,
        message: "Already seeded — 'Odd One Out' questions exist.",
        skipped: true,
      });
    }

    const batch = db.batch();
    const now = Date.now();

    QUESTIONS.forEach((q, i) => {
      const ref = col.doc();
      batch.set(ref, {
        section: "VARC-VA",
        chapter: "Odd One Out",
        difficulty: "Moderate",
        question: q.question,
        questionType: "TITA",
        options: [],
        correctOption: "",
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        published: true,
        position: now + i * 1000,
      });
    });

    await batch.commit();

    return NextResponse.json({
      ok: true,
      message: `Successfully seeded ${QUESTIONS.length} Odd One Out questions.`,
      count: QUESTIONS.length,
    });
  } catch (err) {
    console.error("[seed-odd-one-out]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
