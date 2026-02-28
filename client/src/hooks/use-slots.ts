import { useMutation } from "@tanstack/react-query";
import { api, type GenerateSlotsInput, type GenerateSlotsResponse } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";

export function useGenerateSlots() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: GenerateSlotsInput) => {
      // Input validation before sending
      const validated = api.slots.generate.input.safeParse(data);
      if (!validated.success) {
        throw new Error(validated.error.errors[0].message);
      }

      const res = await fetch(api.slots.generate.path, {
        method: api.slots.generate.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated.data),
        credentials: "include",
      });

      if (!res.ok) {
        let errorMessage = "Failed to generate slots";
        try {
          const errorData = await res.json();
          errorMessage = errorData.message || errorMessage;
        } catch {
          // fallback to default error message if json parsing fails
        }
        throw new Error(errorMessage);
      }

      const json = await res.json();
      return api.slots.generate.responses[200].parse(json);
    },
    onError: (error) => {
      toast({
        title: "Generation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
