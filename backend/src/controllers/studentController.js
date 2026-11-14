import { studentService } from "../services/studentService.js";

export const studentController = {
  async create(req, res, next) {
    try {
      const newStudent = await studentService.createStudent(req.body, req.user.id);

      return res.status(201).json(newStudent);
    } catch (error) {
      next(error);
    }
  },

  async list(req, res, next) {
    try {
      const { status } = req.query;

      const students = await studentService.listStudents(status, req.user.id);

      return res.status(200).json(students);
    } catch (error) {
      next(error);
    }
  },

  async getById(req, res, next) {
    try {
      const student = await studentService.getStudentById(req.params.id, req.user.id);

      return res.status(200).json(student);
    } catch (error) {
      next(error);
    }
  },

  async update(req, res, next) {
    try {
      const updatedStudent = await studentService.updateStudent(req.params.id, req.body, req.user.id);

      return res.status(200).json(updatedStudent);
    } catch (error) {
      next(error);
    }
  },

  async updateStatus(req, res, next) {
    try {
      const updatedStudent = await studentService.updateStudentStatus(req.params.id, req.body, req.user.id);

      return res.status(200).json(updatedStudent);
    } catch (error) {
      next(error);
    }
  },
};
