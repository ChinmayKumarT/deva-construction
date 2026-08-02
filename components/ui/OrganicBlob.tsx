// Soft, hand-drawn-feeling blob accent shape (NYT onboarding-card style).
// Colorable via `fill`/className, sized by the wrapping element -- render it
// absolutely positioned behind content, not inline.
export function OrganicBlob({ className = "", fill = "currentColor" }: { className?: string; fill?: string }) {
  return (
    <svg
      viewBox="0 0 200 200"
      className={className}
      fill={fill}
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M45.5,-58.6C58.4,-51.1,68,-36.9,72.6,-21.2C77.2,-5.4,76.8,11.8,70.2,26.1C63.6,40.3,50.8,51.5,36.4,59.6C22,67.6,6,72.5,-10.9,73.6C-27.8,74.7,-45.6,71.9,-58.1,61.8C-70.6,51.7,-77.8,34.2,-79.9,16.2C-82,-1.9,-79,-20.6,-70.1,-35.4C-61.2,-50.3,-46.4,-61.4,-31,-67.4C-15.6,-73.4,0.4,-74.3,15.4,-70.4C30.4,-66.5,45.5,-58.6,45.5,-58.6Z" transform="translate(100 100)" />
    </svg>
  );
}
