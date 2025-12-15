type Props = {
  className?: string;
  title?: string;
  size?: number;
};

function Title({ title }: { title?: string }) {
  if (!title) return null;
  return <title>{title}</title>;
}

export function MainLogoIcon({ className, title, size = 88 }: Props) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="-15 -15 130 130"
      role={title ? "img" : "presentation"}
      aria-hidden={title ? undefined : true}
    >
      <Title title={title} />
  <polygon points="10,50 50,10 90,50 50,90 " className="iconAccentBox" />
  <rect x="0" y="0" width="100" height="100"/>
  <line x1="50" y1="10" x2="0" y2= "0" />
  <line x1="10" y1="50" x2="0" y2= "100" />
  <line x1="50" y1="90" x2="100" y2= "100" />
  <line x1="90" y1="50" x2="100" y2= "0" />
    <line x1="50" y1="-15" x2="50" y2= "115" className="dasharrayStroke"/>
  <line x1="-15" y1="50" x2="115" y2= "50" className="dasharrayStroke"/>
  <line x1="0" y1="0" x2="100" y2= "100" className="dasharrayStroke"/>
  <line x1="0" y1="100" x2="100" y2= "0" className="dasharrayStroke"/>
    <line x1="-15" y1="0" x2="115" y2= "0" className="dasharrayStroke"/>
    <line x1="-15" y1="100" x2="115" y2= "100" className="dasharrayStroke"/>
    <line x1="0" y1="-15" x2="0" y2= "115" className="dasharrayStroke"/>
    <line x1="100" y1="-15" x2="100" y2= "115" className="dasharrayStroke"/>
    </svg>
  );
}

export function ObserverIcon({ className, title, size = 56 }: Props) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role={title ? "img" : "presentation"}
      aria-hidden={title ? undefined : true}
    >
      <Title title={title} />
      <path d="M2,32 C2,32 14,10 32,10 C50,10 62,32 62,32 C62,32 50,54 32,54 C14,54 2,32 2,32 Z" />
      <circle cx="32" cy="32" r="10" />
      <line x1="32" y1="28" x2="32" y2="10" strokeDasharray="2,2" />
    </svg>
  );
}

export function CreatorIcon({ className, title, size = 56 }: Props) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role={title ? "img" : "presentation"}
      aria-hidden={title ? undefined : true}
    >
      <Title title={title} />
      <path d="M32,2 L58,16 L58,48 L32,62 L6,48 L6,16 Z" />
      <line x1="6" y1="16" x2="32" y2="30" />
      <line x1="58" y1="16" x2="32" y2="30" />
      <line x1="32" y1="62" x2="32" y2="30" />
    </svg>
  );
}
