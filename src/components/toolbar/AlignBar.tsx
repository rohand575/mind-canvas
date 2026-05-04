import { useToolStore } from '../../store/toolStore';
import { useElementStore } from '../../store/elementStore';
import { useHistory } from '../../hooks/useHistory';
import {
  AlignLeftIcon,
  AlignCenterXIcon,
  AlignRightIcon,
  AlignTopIcon,
  AlignCenterYIcon,
  AlignBottomIcon,
  DistributeHIcon,
  DistributeVIcon,
} from './ToolIcons';
import type { AlignmentType, DistributionType } from '../../types';

function AlignButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.08] hover:text-gray-900 dark:hover:text-white transition-colors duration-100"
    >
      {children}
    </button>
  );
}

export function AlignBar() {
  const selectedIds = useToolStore((s) => s.selectedIds);
  const { saveSnapshot } = useHistory();

  if (selectedIds.length < 2) return null;

  const align = (type: AlignmentType) => {
    saveSnapshot();
    useElementStore.getState().alignElements(selectedIds, type);
  };

  const distribute = (axis: DistributionType) => {
    if (selectedIds.length < 3) return;
    saveSnapshot();
    useElementStore.getState().distributeElements(selectedIds, axis);
  };

  return (
    <div className="flex items-center gap-0.5">
      <AlignButton title="Align left edges" onClick={() => align('left')}>
        <AlignLeftIcon />
      </AlignButton>
      <AlignButton title="Align centers horizontally" onClick={() => align('centerX')}>
        <AlignCenterXIcon />
      </AlignButton>
      <AlignButton title="Align right edges" onClick={() => align('right')}>
        <AlignRightIcon />
      </AlignButton>

      <div className="w-px h-4 bg-gray-200 dark:bg-white/10 mx-1" />

      <AlignButton title="Align top edges" onClick={() => align('top')}>
        <AlignTopIcon />
      </AlignButton>
      <AlignButton title="Align centers vertically" onClick={() => align('centerY')}>
        <AlignCenterYIcon />
      </AlignButton>
      <AlignButton title="Align bottom edges" onClick={() => align('bottom')}>
        <AlignBottomIcon />
      </AlignButton>

      {selectedIds.length >= 3 && (
        <>
          <div className="w-px h-4 bg-gray-200 dark:bg-white/10 mx-1" />
          <AlignButton title="Distribute horizontally" onClick={() => distribute('horizontal')}>
            <DistributeHIcon />
          </AlignButton>
          <AlignButton title="Distribute vertically" onClick={() => distribute('vertical')}>
            <DistributeVIcon />
          </AlignButton>
        </>
      )}
    </div>
  );
}
