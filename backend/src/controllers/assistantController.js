import { assistantService } from "../services/assistantService.js";

export const assistantController = {
  async sendMessage(req, res, next) {
    try {
      const { message, conversationId } = req.body ?? {};

      if (typeof message !== "string" || !message.trim()) {
        return res.status(400).json({
          error: {
            status: 400,
            message: "A mensagem não pode estar vazia.",
          },
        });
      }

      if (
        conversationId !== undefined &&
        conversationId !== null &&
        (typeof conversationId !== "string" || !conversationId.trim())
      ) {
        return res.status(400).json({
          error: {
            status: 400,
            message: "O identificador da conversa é inválido.",
          },
        });
      }

      const result = await assistantService.sendMessage(message.trim(), conversationId, req.user.id);

      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },
};
