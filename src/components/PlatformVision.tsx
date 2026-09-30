import { ArrowRight } from "lucide-react";

const steps = [
  "See what people believe in",
  "Participate",
  "Validate it",
  "Launch it",
  "Trade it",
];

export function PlatformVision() {
  return (
    <section className="platform-vision" aria-labelledby="platform-vision-title">
      <h2 id="platform-vision-title" className="eyebrow">OUR VISION</h2>
      <ol>
        {steps.map((step, index) => (
          <li key={step}>
            <span className="vision-number" aria-hidden="true">0{index + 1}</span>
            <span>{step}</span>
            {index < steps.length - 1 && <ArrowRight size={16} aria-hidden="true" />}
          </li>
        ))}
      </ol>
    </section>
  );
}
