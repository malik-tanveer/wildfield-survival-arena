import { createFileRoute } from "@tanstack/react-router";
import { GameScreen } from "@/game/GameScreen";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Field Ops — Solo Survival Match" },
      {
        name: "description",
        content: "Deploy into a compact tactical arena, take on hostile bots, and survive the match.",
      },
      { property: "og:title", content: "Field Ops — Solo Survival Match" },
      {
        property: "og:description",
        content: "Deploy into a compact tactical arena, take on hostile bots, and survive the match.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GameScreen,
});