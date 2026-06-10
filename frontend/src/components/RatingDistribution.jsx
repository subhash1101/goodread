import React from "react";

export default function RatingDistribution({ distribution = {} }) {
  const max = Math.max(1, ...Object.values(distribution).map(Number));
  return (
    <div className="distribution">
      {[5, 4, 3, 2, 1].map((star) => {
        const value = Number(distribution[String(star)] || 0);
        return (
          <div className="bar-row" key={star}>
            <span>{star} star</span>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${(value / max) * 100}%` }} />
            </div>
            <span>{value.toLocaleString()}</span>
          </div>
        );
      })}
    </div>
  );
}
