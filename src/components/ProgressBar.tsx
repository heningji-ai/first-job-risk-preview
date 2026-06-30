type ProgressBarProps = {
  current: number;
  total: number;
};

function ProgressBar({ current, total }: ProgressBarProps) {
  const safeTotal = Math.max(total, 1);
  const percent = Math.round((current / safeTotal) * 100);

  return (
    <div className="progress" aria-label={`答题进度 ${current}/${total}`}>
      <div className="progress-meta">
        <span>进度</span>
        <span>
          {current}/{total}
        </span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export default ProgressBar;
