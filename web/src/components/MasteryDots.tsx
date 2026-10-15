/** Five dots showing how well a word is known (Leitner box 1-5; box 0 = new). */
export function MasteryDots({ box }: { box: number }) {
  return (
    <span className="dots" role="img" aria-label={`Mastery ${Math.min(box, 5)} of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <i key={n} data-on={box >= n} />
      ))}
    </span>
  );
}
