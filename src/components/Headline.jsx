// Wide grotesque headline with fraktur capitals, as in the reference.
const F = ({ children }) => <span className="frak">{children}</span>;

export default function Headline() {
  return (
    <h1 className="headline" aria-label="Let it bloom above clouds">
      <span className="line" aria-hidden="true"><F>L</F>et it <F>B</F>loom</span>
      <span className="line" aria-hidden="true"><F>A</F>bove <F>C</F>louds</span>
    </h1>
  );
}
