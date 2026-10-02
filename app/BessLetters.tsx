import type { CSSProperties } from "react";

export function BessLetters({ text, stagger = 0.035 }: { text: string; stagger?: number }) {
  return <span className="bess-letter-word" aria-label={text}>{Array.from(text).map((letter, index) => <span aria-hidden="true" key={index} style={{ "--letter-delay": `${index * stagger}s` } as CSSProperties}>{letter === " " ? "\u00a0" : letter}</span>)}</span>;
}
