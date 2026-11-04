import { monthlyService } from "../services/monthlyService.js";

export const monthlyController = {
  async listMonths(req, res, next) {
    try {
      const months = await monthlyService.listMonths();
      return res.status(200).json(months);
    } catch (error) {
      next(error);
    }
  },

  async getMonthRecords(req, res, next) {
    try {
      const { reference_id } = req.params;
      const result = await monthlyService.getMonthRecords(reference_id);
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },

  async createRecord(req, res, next) {
    try {
      const { reference_id } = req.params;
      const newRecord = await monthlyService.createRecord(reference_id, req.body);
      return res.status(201).json(newRecord);
    } catch (error) {
      next(error);
    }
  },

  async updateRecord(req, res, next) {
    try {
      const { id } = req.params;
      const updatedRecord = await monthlyService.updateRecord(id, req.body);
      return res.status(200).json(updatedRecord);
    } catch (error) {
      next(error);
    }
  },

  async updateRecordPayment(req, res, next) {
    try {
      const { id } = req.params;
      const updatedRecord = await monthlyService.updateRecordPayment(id, req.body);
      return res.status(200).json(updatedRecord);
    } catch (error) {
      next(error);
    }
  },

  async deleteRecord(req, res, next) {
    try {
      const { id } = req.params;
      const deletedRecord = await monthlyService.deleteRecord(id);
      return res.status(200).json(deletedRecord);
    } catch (error) {
      next(error);
    }
  },

  async copyMonthRecords(req, res, next) {
    try {
      const result = await monthlyService.copyMonthRecords(req.body);
      return res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  },

  async deleteMonth(req, res, next) {
    try {
      const { id } = req.params;
      const result = await monthlyService.deleteMonth(id);
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },
};
