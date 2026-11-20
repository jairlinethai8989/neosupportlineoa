'use client';

import React from 'react';
import { clsx } from 'clsx';
import styles from './ui.module.css';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
}

/**
 * Flat hairline surface container (1px border, subtle shadow, no glassmorphism).
 */
export const Card = React.forwardRef<HTMLDivElement, CardProps>(function Card(
  { interactive = false, className, children, ...rest },
  ref
) {
  return (
    <div
      ref={ref}
      className={clsx(styles.card, interactive && styles.cardInteractive, className)}
      {...rest}
    >
      {children}
    </div>
  );
});

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  actions?: React.ReactNode;
}

export function CardHeader({ actions, className, children, ...rest }: CardHeaderProps) {
  return (
    <div className={clsx(styles.cardHeader, className)} {...rest}>
      <div className={styles.cardHeaderText}>{children}</div>
      {actions ? <div>{actions}</div> : null}
    </div>
  );
}

export function CardTitle({ className, children, ...rest }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={clsx(styles.cardTitle, className)} {...rest}>
      {children}
    </h3>
  );
}

export function CardDescription({ className, children, ...rest }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={clsx(styles.cardDescription, className)} {...rest}>
      {children}
    </p>
  );
}

export interface CardBodyProps extends React.HTMLAttributes<HTMLDivElement> {
  compact?: boolean;
}

export function CardBody({ compact = false, className, children, ...rest }: CardBodyProps) {
  return (
    <div className={clsx(styles.cardBody, compact && styles.cardBodyCompact, className)} {...rest}>
      {children}
    </div>
  );
}
