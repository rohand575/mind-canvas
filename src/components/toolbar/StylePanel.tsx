import { useToolStore } from '../../store/toolStore';
import { useElementStore } from '../../store/elementStore';
import { COLOR_PALETTE, STROKE_WIDTHS } from '../../constants';

export function StylePanel() {
  const { strokeColor, setStrokeColor, fillColor, setFillColor, strokeWidth, setStrokeWidth, selectedIds } = useToolStore();

  // Update selected elements when style changes
  const applyToSelected = (updates: Record<string, unknown>) => {
    const { updateElement } = useElementStore.getState();
    for (const id of selectedIds) {
      updateElement(id, updates);
    }
  };

  return (
    <div className="flex items-center gap-3">
      {/* Stroke Color */}
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">Stroke</span>
        <div className="flex gap-0.5">
          {COLOR_PALETTE.filter(c => c !== 'transparent').map((color) => (
            <button
              key={`stroke-${color}`}
              title={color}
              onClick={() => {
                setStrokeColor(color);
                applyToSelected({ strokeColor: color });
              }}
              className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 ${
                strokeColor === color ? 'border-indigo-500 scale-110' : 'border-gray-200 dark:border-gray-600'
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="w-px h-6 bg-gray-200 dark:bg-gray-600" />

      {/* Fill Color */}
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">Fill</span>
        <div className="flex gap-0.5">
          {COLOR_PALETTE.map((color) => (
            <button
              key={`fill-${color}`}
              title={color === 'transparent' ? 'No fill' : color}
              onClick={() => {
                setFillColor(color);
                applyToSelected({ fillColor: color });
              }}
              className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 ${
                fillColor === color ? 'border-indigo-500 scale-110' : 'border-gray-200 dark:border-gray-600'
              }`}
              style={{
                backgroundColor: color === 'transparent' ? undefined : color,
                backgroundImage: color === 'transparent'
                  ? 'linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%), linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%)'
                  : undefined,
                backgroundSize: color === 'transparent' ? '6px 6px' : undefined,
                backgroundPosition: color === 'transparent' ? '0 0, 3px 3px' : undefined,
              }}
            />
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="w-px h-6 bg-gray-200 dark:bg-gray-600" />

      {/* Stroke Width */}
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">Width</span>
        <div className="flex gap-0.5">
          {STROKE_WIDTHS.map((w) => (
            <button
              key={`sw-${w}`}
              title={`${w}px`}
              onClick={() => {
                setStrokeWidth(w);
                applyToSelected({ strokeWidth: w });
              }}
              className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
                strokeWidth === w
                  ? 'bg-indigo-100 dark:bg-indigo-900/40'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700/50'
              }`}
            >
              <div
                className="bg-gray-700 dark:bg-gray-300 rounded-full"
                style={{ width: `${Math.min(w * 3, 16)}px`, height: `${Math.min(w * 3, 16)}px` }}
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
