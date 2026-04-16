"use client";

import { useRouter } from "next/navigation";
import { Plus, Settings } from "lucide-react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import { useNotebooks } from "@/hooks/use-notebooks";

export const CommandPalette = ({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): React.ReactNode => {
  const router = useRouter();
  const { data: notebooks } = useNotebooks();

  const runAction = (fn: () => void): void => {
    onOpenChange(false);
    fn();
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search notebooks, actions..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Quick Actions">
          <CommandItem
            onSelect={() =>
              runAction(() => {
                window.dispatchEvent(
                  new CustomEvent("fluxmind:create-notebook")
                );
              })
            }
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Notebook
          </CommandItem>
          <CommandItem
            onSelect={() => runAction(() => router.push("/settings"))}
          >
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </CommandItem>
        </CommandGroup>
        {notebooks && notebooks.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Notebooks">
              {notebooks.slice(0, 8).map((notebook) => (
                <CommandItem
                  key={notebook.id}
                  onSelect={() =>
                    runAction(() => router.push(`/notebook/${notebook.id}`))
                  }
                >
                  <span className="mr-2">{notebook.icon ?? "📓"}</span>
                  {notebook.title}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
};
