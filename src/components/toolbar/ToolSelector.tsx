import { useToolStore } from '../../store/toolStore';
import { IconButton } from '../ui/IconButton';
import { TOOL_ICON_MAP } from './ToolIcons';
import { TOOLS } from '../../constants';

export function ToolSelector() {
  const { activeTool, setActiveTool } = useToolStore();

  return (
    <div className="flex flex-col gap-1.5">
      {TOOLS.map((tool) => {
        const Icon = TOOL_ICON_MAP[tool.icon];
        return (
          <IconButton
            key={tool.id}
            active={activeTool === tool.id}
            title={`${tool.label} (${tool.shortcut})`}
            onClick={() => setActiveTool(tool.id)}
          >
            {Icon ? <Icon /> : tool.label[0]}
          </IconButton>
        );
      })}
    </div>
  );
}
