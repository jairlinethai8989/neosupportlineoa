import React from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, rectSortingStrategy } from '@dnd-kit/sortable';
import { SortableWidget } from './SortableWidget';
import styles from './analytics.module.css';

interface SortableWidgetGridProps {
  activeWidgets: string[];
  setActiveWidgets: React.Dispatch<React.SetStateAction<string[]>>;
  CHART_TYPES: { id: string; name: string; icon: React.ElementType; type: string }[];
  chartDataMap: Record<string, unknown[]>;
}

export function SortableWidgetGrid({ activeWidgets, setActiveWidgets, CHART_TYPES, chartDataMap }: SortableWidgetGridProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    if (active.id !== over.id) {
      setActiveWidgets((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={activeWidgets} strategy={rectSortingStrategy}>
        <div className={styles.widgetGrid}>
          {activeWidgets.map((id) => {
            const chart = CHART_TYPES.find((c) => c.id === id);
            if (!chart) return null;
            return (
              <SortableWidget
                key={id}
                id={id}
                chart={chart}
                data={chartDataMap[id as keyof typeof chartDataMap] || []}
                onRemove={(rid: string) => setActiveWidgets((prev) => prev.filter((w) => w !== rid))}
              />
            );
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
}
