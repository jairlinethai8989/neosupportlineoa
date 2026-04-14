import React from 'react';

export interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  marginBottom?: string | number;
  marginTop?: string | number;
  className?: string;
  style?: React.CSSProperties;
}

const Skeleton = ({ 
  width = '100%', 
  height = '1rem', 
  borderRadius = '8px', 
  marginBottom,
  marginTop,
  className = '', 
  style = {} 
}: SkeletonProps) => {
  return (
    <div 
      className={`skeleton ${className}`} 
      style={{ 
        width, 
        height, 
        borderRadius,
        marginBottom,
        marginTop,
        ...style 
      }} 
    />
  );
};

export default Skeleton;
