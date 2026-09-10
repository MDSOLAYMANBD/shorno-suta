interface Props {
  text?: string;
  bgColor?: string;
  textColor?: string;
}

export default function LandingFooter({ text, bgColor, textColor }: Props) {
  return (
    <footer className="py-4 px-4 text-center pb-20" style={{ backgroundColor: bgColor || '#333333' }}>
      <p className="text-xs" style={{ color: textColor || '#999' }}>
        {text || 'Trade License No: TRAD/DSCC/046208/2020 | © 2020-2025 SHORNO SUTA. All Rights Reserved.'}
      </p>
    </footer>
  );
}
