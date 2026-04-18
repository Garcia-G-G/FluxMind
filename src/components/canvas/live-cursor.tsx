"use client";

import { motion } from "motion/react";

export type CursorData = {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
};

export const LiveCursor = ({
  cursor,
}: {
  cursor: CursorData;
}): React.ReactNode => {
  return (
    <motion.div
      className="absolute pointer-events-none z-50"
      animate={{ x: cursor.x, y: cursor.y }}
      transition={{ type: "spring", damping: 30, stiffness: 200 }}
    >
      {/* Cursor arrow */}
      <svg width="16" height="20" viewBox="0 0 16 20" fill="none">
        <path
          d="M0.5 0.5L15.5 12.5L8 13.5L5 19.5L0.5 0.5Z"
          fill={cursor.color}
          stroke="white"
          strokeWidth="1"
        />
      </svg>

      {/* Name label */}
      <div
        className="ml-4 -mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium text-white whitespace-nowrap"
        style={{ background: cursor.color }}
      >
        {cursor.name}
      </div>
    </motion.div>
  );
};

export const LiveCursorsOverlay = ({
  cursors,
}: {
  cursors: CursorData[];
}): React.ReactNode => {
  if (cursors.length === 0) return null;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-50">
      {cursors.map((cursor) => (
        <LiveCursor key={cursor.id} cursor={cursor} />
      ))}
    </div>
  );
};
