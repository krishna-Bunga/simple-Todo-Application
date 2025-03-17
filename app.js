const express = require('express')
const app = express()
let format = require('date-fns/format')
let isValid = require('date-fns/isValid')
let parseISO = require('date-fns/parseISO')
let parse = require('date-fns/parse')

app.use(express.json())

const {open} = require('sqlite')
const sqlite3 = require('sqlite3')

const path = require('path')
const dbPath = path.join(__dirname, 'todoApplication.db')

let db = null

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => console.log('Server is running'))
  } catch (error) {
    console.log(`DB Error: ${error.message}`)
  }
}

initializeDBAndServer()

const convertToCamelCase = todoObject => {
  return {
    id: todoObject.id,
    todo: todoObject.todo,
    priority: todoObject.priority,
    status: todoObject.status,
    category: todoObject.category,
    dueDate: todoObject.due_date,
  }
}

let statusValues = ['IN PROGRESS', 'DONE', 'TO DO']
let categoryValues = ['LEARNING', 'HOME', 'WORK']
let priorityValues = ['LOW', 'MEDIUM', 'HIGH']

let isStatusValid
let isCategoryValid
let isPriorityValid

const checkingValidTodo = (request, response, next) => {
  const {status, priority, category, search_q, date} = request.query

  const parseDate = parse(date, 'yyyy-MM-dd', new Date())

  isStatusValid = statusValues.includes(status)
  isCategoryValid = categoryValues.includes(category)
  isPriorityValid = priorityValues.includes(priority)

  if (isStatusValid === false && status !== undefined) {
    response.status(400)
    response.send('Invalid Todo Status')
  } else if (isPriorityValid === false && priority !== undefined) {
    response.status(400)
    response.send('Invalid Todo Priority')
  } else if (isCategoryValid === false && category !== undefined) {
    response.status(400)
    response.send('Invalid Todo Category')
  } else if (isValid(parseDate) === false && date !== undefined) {
    response.status(400)
    response.send('Invalid Due Date')
  } else {
    next()
  }
}

app.get('/todos/', checkingValidTodo, async (request, response) => {
  const {status, priority, category, search_q} = request.query

  let query = ''

  if (
    status === undefined &&
    priority === undefined &&
    category === undefined
  ) {
    query = `SELECT * FROM todo;`
  }

  if (search_q !== undefined) {
    query = `SELECT * FROM todo WHERE todo LIKE '%${search_q}%';`
  } else {
    if (isStatusValid || isCategoryValid || isPriorityValid) {
      if (isStatusValid && isPriorityValid) {
        query = `SELECT * FROM todo WHERE status = '${status}' AND priority = '${priority}';`
      } else if (isCategoryValid && isStatusValid) {
        query = `SELECT * FROM todo WHERE status LIKE '${status}' AND category LIKE '${category}';`
      } else if (isPriorityValid && isCategoryValid) {
        query = `SELECT * FROM todo WHERE category = '${category}' AND priority = '${priority}';`
      } else if (isStatusValid) {
        query = `SELECT * FROM todo WHERE  status = '${status}';`
      } else if (isPriorityValid) {
        query = `SELECT * FROM todo WHERE priority = '${priority}';`
      } else if (isCategoryValid) {
        query = `SELECT * FROM todo WHERE category = '${category}';`
      }
    }
  }

  const dbResponse = await db.all(query)
  const inCamelCase = dbResponse.map(eachTodo => {
    return convertToCamelCase(eachTodo)
  })
  response.send(inCamelCase)
})

app.get('/todos/:todoId/', async (request, response) => {
  const {todoId} = request.params

  const getTodoQuery = `SELECT * FROM todo WHERE id = ${todoId};`

  const getTodoResponse = await db.get(getTodoQuery)
  const getCamelCase = convertToCamelCase(getTodoResponse)
  response.send(getCamelCase)
})

app.get('/agenda/', checkingValidTodo, async (request, response) => {
  const {date} = request.query
  const validDate = format(new Date(date), 'yyyy-MM-dd')
  //const parseDate = parse(date, "yyyy-MM-dd", new Date()); //isValid function will not support string data type, So convert it in to date by using parse function.

  const dateQuery = `SELECT * FROM todo WHERE due_date = '${validDate}';`
  const dateResponse = await db.all(dateQuery)
  const isCamelCase = dateResponse.map(eachDateObject => {
    return convertToCamelCase(eachDateObject)
  })
  response.send(isCamelCase)
})

const checkingTodoBeforeUpdating = (request, response, next) => {
  const {status, priority, todo, category, dueDate} = request.body

  const parseDate = parse(dueDate, 'yyyy-MM-dd', new Date())

  isStatusValid = statusValues.includes(status)
  isCategoryValid = categoryValues.includes(category)
  isPriorityValid = priorityValues.includes(priority)

  if (isStatusValid === false && status !== undefined) {
    response.status(400)
    response.send('Invalid Todo Status')
  } else if (isPriorityValid === false && priority !== undefined) {
    response.status(400)
    response.send('Invalid Todo Priority')
  } else if (isCategoryValid === false && category !== undefined) {
    response.status(400)
    response.send('Invalid Todo Category')
  } else if (isValid(parseDate) === false && dueDate !== undefined) {
    response.status(400)
    response.send('Invalid Due Date')
  } else {
    next()
  }
}

app.post('/todos/', checkingTodoBeforeUpdating, async (request, response) => {
  const {id, todo, priority, status, category, dueDate} = request.body
  const addTodoQuery = `INSERT INTO todo(id, todo, priority, status, category, due_date)
                            VALUES(
                                ${id},
                                '${todo}',
                                '${priority}',
                                '${status}',
                                '${category}',
                                '${dueDate}'
                            );`
  const addTodoToDatabase = await db.run(addTodoQuery)
  const newTodoId = addTodoToDatabase.lastID
  //const addNewIdToTodo = await db.run(addNewIdQuery);
  console.log(newTodoId)
  console.log(addTodoToDatabase)
  response.send('Todo Successfully Added')
})

app.put(
  '/todos/:todoId/',
  checkingTodoBeforeUpdating,
  async (request, response) => {
    const {todoId} = request.params
    const {status, priority, todo, category, dueDate} = request.body

    const parseDate = parseISO(dueDate)

    let updateTodoQuery = ''
    let message

    if (status === 'TO DO' || status === 'IN PROGRESS' || status === 'DONE') {
      updateTodoQuery = `UPDATE todo SET status = '${status}' WHERE id = ${todoId};`
      message = 'Status Updated'
    }

    if (priority === 'LOW' || priority === 'MEDIUM' || priority === 'HIGH') {
      updateTodoQuery = `UPDATE todo SET priority = '${priority}' WHERE id = ${todoId};`
      message = 'Priority Updated'
    }
    if (category === 'WORK' || category === 'HOME' || category === 'LEARNING') {
      updateTodoQuery = `UPDATE todo SET category = '${category}' WHERE id = ${todoId};`
      message = 'Category Updated'
    }
    if (todo !== undefined) {
      updateTodoQuery = `UPDATE todo SET todo = '${todo}' WHERE id = ${todoId};`
      message = 'Todo Updated'
    }
    if (isValid(parseDate)) {
      updateTodoQuery = `UPDATE todo SET due_date = '${dueDate}' WHERE id = ${todoId};`
      message = 'Due Date Updated'
    }

    const updateTodoInDatabase = await db.run(updateTodoQuery)
    response.send(message)
  },
)

//Delete API
app.delete('/todos/:todoId/', async (request, response) => {
  const {todoId} = request.params

  const deleteTodoQuery = `DELETE FROM todo WHERE id = ${todoId};`
  const updateDatabase = await db.run(deleteTodoQuery)
  response.send('Todo Deleted')
})

module.exports = app
