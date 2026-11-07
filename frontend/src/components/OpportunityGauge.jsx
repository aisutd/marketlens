
import { getScoreBand } from "../constants/scoreBands";

export default function OpportunityGauge({ score }) {
  const hasScore =
    typeof score === "number" &&
    Number.isFinite(score);

  const normalizedScore = hasScore
    ? Math.max(0, Math.min(100, score))
    : 0;

  const { label: scoreLabel, color: scoreColor } =
    getScoreBand(score);

  const totalSegments = 40;

  const activeSegments = Math.round(
    (normalizedScore / 100) * totalSegments
  );

  const segments = Array.from(
    { length: totalSegments },
    (_, index) => {
      const angle =
        135 + (270 / (totalSegments - 1)) * index;

      const radians = (angle * Math.PI) / 180;

      const center = 80;
      const radius = 65;

      const x = center + Math.cos(radians) * radius;
      const y = center + Math.sin(radians) * radius;

      return {
        x,
        y,
        angle,
        active: index < activeSegments,
      };
    }
  );

  return (
    <div
      className="relative h-40 w-40 shrink-0"
      role="img"
      aria-label={
        hasScore
          ? `Opportunity score: ${score} out of 100. ${scoreLabel}`
          : "Opportunity score not available"
      }
    >
      <svg
        viewBox="0 0 160 160"
        width="160"
        height="160"
        aria-hidden="true"
      >
        {segments.map((segment, index) => (
          <rect
            key={index}
            x={segment.x - 2}
            y={segment.y - 5}
            width="4"
            height="10"
            rx="1"
            transform={`rotate(${
              segment.angle + 90
            } ${segment.x} ${segment.y})`}
            fill={
              !hasScore
                ? "#E2E8F0"
                : normalizedScore === 0
                ? "#FECACA"
                : segment.active
                ? scoreColor
                : "#E2E8F0"
            }
          />
        ))}
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="flex items-baseline">
          <span
            className="text-[46px] font-semibold leading-none"
            style={{ color: scoreColor }}
          >
            {hasScore ? score : "—"}
          </span>

          <span className="ml-1 text-sm text-[#475569]">
            /100
          </span>
        </div>

        <span
          className="mt-3 text-xs font-medium"
          style={{ color: scoreColor }}
        >
          {scoreLabel}
        </span>
      </div>
    </div>
  );
}
