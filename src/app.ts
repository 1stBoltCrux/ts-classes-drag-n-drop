// drag and drop interfaces

interface Draggable {
	dragStartHandler(event: DragEvent): void;
	dragEndHandler(event: DragEvent): void;
}

interface DragTarget {
	dragOverHandler(event: DragEvent): void;
	dropHandler(event: DragEvent): void;
	dragLeaveHandler(event: DragEvent): void;
}

// Project Type

enum ProjectStatus {
	Active,
	Finished
}

class Project {
	constructor(
		public id: string,
		public title: string,
		public description: string,
		public people: number,
		public status: ProjectStatus
	) {}
}

type Listener<T> = (items: T[]) => void;

class State<T> {
	protected listeners: Listener<T>[] = [];

	addListener(listenerFn: Listener<T>) {
		this.listeners.push(listenerFn);
	}
}
//Project state management -

class ProjectState extends State<Project> {
	private projects: any[] = [];
	private static instance: ProjectState;

	private constructor() {
		super();
	}

	static getInstance() {
		if (this.instance) {
			return this.instance;
		}
		this.instance = new ProjectState();
		return this.instance;
	}

	addProject(title: string, description: string, numOfPeople: number) {
		const newProject = new Project(
			Math.random().toString(),
			title,
			description,
			numOfPeople,
			ProjectStatus.Active
		);
		this.projects.push(newProject);
		this.updateListeners();
	}

	moveProject(projectId: string, newStatus: ProjectStatus) {
		const project = this.projects.find(prj => prj.id === projectId);
		if (project && project.status !== newStatus) {
			console.log("firing");
			project.status = newStatus;
			this.updateListeners();
		}
	}

	updateListeners() {
		for (const listenerFn of this.listeners) {
			listenerFn(this.projects.slice());
		}
	}
}

const projectState = ProjectState.getInstance();

interface Validatable {
	value: string | number;
	required?: boolean;
	minLength?: number;
	maxLength?: number;
	min?: number;
	max?: number;
}

function Validate(validatableInput: Validatable) {
	let isValid = true;
	if (validatableInput.required) {
		isValid = isValid && validatableInput.value.toString().trim().length !== 0;
	}
	if (
		validatableInput.minLength &&
		typeof validatableInput.value === "string"
	) {
		isValid =
			isValid &&
			validatableInput.value.trim().length >= validatableInput.minLength;
	}
	if (
		validatableInput.maxLength &&
		typeof validatableInput.value === "string"
	) {
		isValid =
			isValid &&
			validatableInput.value.trim().length <= validatableInput.maxLength;
	}
	if (
		validatableInput.min != null &&
		typeof validatableInput.value === "number"
	) {
		isValid = isValid && validatableInput.value >= validatableInput.min;
	}
	if (
		validatableInput.max != null &&
		typeof validatableInput.value === "number"
	) {
		isValid = isValid && validatableInput.value <= validatableInput.max;
	}
	return isValid;
}

function AutoBind(_: any, _2: string, descriptor: PropertyDescriptor) {
	const originalMethod = descriptor.value;
	const adjDescriptor: PropertyDescriptor = {
		configurable: true,
		enumerable: false,
		get() {
			const boundFunction = originalMethod.bind(this);
			return boundFunction;
		}
	};
	return adjDescriptor;
}

// Component Base Class
// cannot be instantiated as it is abstract

abstract class Component<T extends HTMLElement, U extends HTMLElement> {
	templateElement: HTMLTemplateElement;
	hostElement: T;
	element: U;

	constructor(
		templateId: string,
		hostElementId: string,
		insertAtStart: boolean,
		newElementId?: string
	) {
		this.templateElement = (<HTMLTemplateElement>(
			document.getElementById(templateId)!
		)) as HTMLTemplateElement;

		this.hostElement = document.getElementById(hostElementId)! as T;

		const importedNode = document.importNode(
			this.templateElement.content,
			true
		);
		this.element = importedNode.firstElementChild as U;
		if (newElementId) {
			this.element.id = newElementId;
		}

		this.attach(insertAtStart);
	}

	private attach(insertAtBeginning: boolean) {
		this.hostElement.insertAdjacentElement(
			insertAtBeginning ? "afterbegin" : "beforeend",
			this.element
		);
	}

	abstract configure(): void;
	abstract renderContent(): void;
}

// ProjectList Class
class ProjectList extends Component<HTMLDivElement, HTMLElement>
	implements DragTarget {
	assignedProjects: Project[];

	constructor(private type: "active" | "finished") {
		super("project-list", "app", false, `${type}-projects`);
		this.assignedProjects = [];

		this.configure();
		this.renderContent();
	}

	renderProjects() {
		const listEl = document.getElementById(
			`${this.type}-projects-list`
		)! as HTMLUListElement;
		listEl.innerHTML = "";
		for (const prjItem of this.assignedProjects) {
			new ProjectItem(this.element.querySelector("ul")!.id, prjItem);
		}
	}
	@AutoBind
	dragOverHandler(event: DragEvent) {
		if (event.dataTransfer && event.dataTransfer.types[0] === "text/plain") {
			event.preventDefault();
			const listEL = this.element.querySelector("ul")!;
			listEL.classList.add("droppable");
		}
	}
	@AutoBind
	dragLeaveHandler(_event: DragEvent) {
		const listEL = this.element.querySelector("ul")!;
		listEL.classList.remove("droppable");
	}
	@AutoBind
	dropHandler(event: DragEvent) {
		const prjId = event.dataTransfer!.getData("text/plain");
		projectState.moveProject(
			prjId,
			this.type === "active" ? ProjectStatus.Active : ProjectStatus.Finished
		);
	}

	configure() {
		this.element.addEventListener("dragover", this.dragOverHandler);
		this.element.addEventListener("dragleave", this.dragLeaveHandler);
		this.element.addEventListener("drop", this.dropHandler);
		projectState.addListener((projects: Project[]) => {
			const relevantProjects = projects.filter(prj => {
				if (this.type === "active") {
					return prj.status === ProjectStatus.Active;
				}
				return prj.status === ProjectStatus.Finished;
			});
			this.assignedProjects = relevantProjects;
			this.renderProjects();
		});
	}

	renderContent() {
		const listId = `${this.type}-projects-list`;
		this.element.querySelector("ul")!.id = listId;
		this.element.querySelector("h2")!.textContent =
			this.type.toUpperCase() + " PROJECTS";
	}
}

class ProjectItem extends Component<HTMLUListElement, HTMLLIElement>
	implements Draggable {
	private project: Project;

	get persons() {
		if (this.project.people === 1) {
			return "1 person";
		} else {
			return `${this.project.people} people`;
		}
	}

	constructor(hostId: string, project: Project) {
		super("single-project", hostId, false, project.id);
		this.project = project;

		this.configure();
		this.renderContent();
	}
	@AutoBind
	dragStartHandler(event: DragEvent) {
		event.dataTransfer!.setData("text/plain", this.project.id);
		event.dataTransfer!.effectAllowed = "move";
	}
	@AutoBind
	dragEndHandler(_event: DragEvent) {}

	configure() {
		this.element.addEventListener("dragstart", this.dragStartHandler);
		this.element.addEventListener("dragend", this.dragEndHandler);
	}

	renderContent() {
		this.element.querySelector("h2")!.textContent = this.project.title;
		this.element.querySelector("h3")!.textContent = this.persons + " assigned";
		this.element.querySelector("p")!.textContent = this.project.description;
	}
}

class ProjectInput extends Component<HTMLDivElement, HTMLFormElement> {
	titleInputElement: HTMLInputElement;
	descriptionInputElement: HTMLInputElement;
	peopleInputElement: HTMLInputElement;

	constructor() {
		super("project-input", "app", true, "user-input");
		this.titleInputElement = <HTMLInputElement>(
			this.element.querySelector("#title")
		);
		this.descriptionInputElement = <HTMLInputElement>(
			this.element.querySelector("#description")
		);
		this.peopleInputElement = <HTMLInputElement>(
			this.element.querySelector("#people")
		);
		this.configure();
	}

	configure() {
		this.element.addEventListener("submit", this.submitHandler);
	}

	renderContent() {}

	private gatherUserInput(): [string, string, number] | void {
		const enteredTitle = this.titleInputElement.value;
		const enteredDescription = this.descriptionInputElement.value;
		const enteredPeople = +this.peopleInputElement.value;

		const titleValidatable: Validatable = {
			value: enteredTitle,
			required: true
		};

		const descriptionValidatable: Validatable = {
			value: enteredDescription,
			required: true,
			minLength: 5
		};

		const peopleValidatable: Validatable = {
			value: enteredPeople,
			required: true,
			min: 1,
			max: 4
		};

		this.clearInputs(
			this.titleInputElement,
			this.descriptionInputElement,
			this.peopleInputElement
		);

		if (
			!Validate(titleValidatable) ||
			!Validate(descriptionValidatable) ||
			!Validate(peopleValidatable)
		) {
			alert("Invalid input, please try again");
			return;
		} else {
			console.log([enteredTitle, enteredDescription, +enteredPeople]);
			return [enteredTitle, enteredDescription, +enteredPeople];
		}
	}

	clearInputs(...args: HTMLInputElement[]) {
		for (const arg of args) {
			arg.value = "";
		}
	}

	@AutoBind
	private submitHandler(event: Event) {
		event.preventDefault();
		const userInput = this.gatherUserInput();
		if (Array.isArray(userInput)) {
			const [title, desc, people] = userInput;
			projectState.addProject(title, desc, people);
			this.clearInputs(
				this.titleInputElement,
				this.descriptionInputElement,
				this.peopleInputElement
			);
		}
	}
}

const prjInput = new ProjectInput();
const activePrjList = new ProjectList("active");
const finishedPrjList = new ProjectList("finished");
