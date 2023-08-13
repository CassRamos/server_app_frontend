import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import {
  BehaviorSubject,
  Observable,
  catchError,
  map,
  of,
  startWith,
} from 'rxjs';
import { CustomResponse } from './interface/custom-response';
import { AppState } from './interface/app-state';
import { ServerService } from './service/server.service';
import { DataState } from './enum/data-state.enum';
import { Status } from './enum/status.enum';
import { Server } from './interface/server';
import { NgForm } from '@angular/forms';
import { NotificationService } from './service/notification.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush, //changeDetection collects all views that are to be checked for changes. Use the methods to add and remove views from the tree, initiate change-detection, and explicitly mark views as dirty, meaning that they have changed and need to be re-rendered.
})
export class AppComponent implements OnInit {
  appState$: Observable<AppState<CustomResponse>>;

  // DataState and Status are used in app.component html
  readonly DataState = DataState;
  readonly Status = Status;

  private filterSubject = new BehaviorSubject<string>('');
  private dataSubject = new BehaviorSubject<CustomResponse>(null);
  filterStatus$ = this.filterSubject.asObservable(); //filter to set the status icon in application (spinner to loading or ping to server loaded)
  private isLoading = new BehaviorSubject<Boolean>(false);
  isLoading$ = this.isLoading.asObservable();

  constructor(
    private serverService: ServerService,
    private notifer: NotificationService
  ) {}

  ngOnInit(): void {
    this.appState$ = this.serverService.servers$ //return a list of servers
      .pipe(
        map((response) => {
          this.notifer.onDefault(response.message);
          this.dataSubject.next(response); //after makes the first call to the backend the response is saved in dataSubject (contains the CustomResponse body of the server)
          return {
            dataState: DataState.LOADED_STATE,
            appData: {
              ...response,
              data: { servers: response.data.servers.reverse() }, //the last server added remains at the top of the list
            },
          }; //when we have a response a object is returned and the state defined is a loaded_state
        }),
        startWith({ dataState: DataState.LOADING_STATE }), //when a response is not returned the state defined is LOADING_STATE and we don't need to pass a object of type null in response returned because the Observable executes this
        catchError((error: string) => {
          this.notifer.onError(error);
          return of({ dataState: DataState.ERROR, error });
        })
      );
  }

  pingServer(ipAddress: string): void {
    this.filterSubject.next(ipAddress);
    this.appState$ = this.serverService
      .ping$(ipAddress) //calling the ping method
      .pipe(
        map((response) => {
          this.notifer.onDefault(response.message);
          //finds in list of servers a server with the id equals to the id stored in dataSubject (these lines return a index)
          const index = this.dataSubject.value.data.servers.findIndex(
            (server) => (server.id = response.data.server.id)
          );
          this.dataSubject.value.data.servers[index] = response.data.server; //replaces the server it contains this particular index with the server finded in the backend
          this.filterSubject.next('');
          return {
            dataState: DataState.LOADED_STATE,
            appData: this.dataSubject.value,
          };
        }),
        startWith({
          dataState: DataState.LOADED_STATE,
          appData: this.dataSubject.value, //value contains the data of server previously saved in OnInit()
        }),
        catchError((error: string) => {
          this.notifer.onError(error);
          return of({ dataState: DataState.ERROR, error });
        })
      );
  }

  saveServer(serverForm: NgForm): void {
    this.isLoading.next(true);
    this.appState$ = this.serverService.save$(serverForm.value as Server).pipe(
      map((response) => {
        this.notifer.onDefault(response.message);
        this.dataSubject.next({
          ...response,
          data: {
            servers: [
              response.data.server,
              ...this.dataSubject.value.data.servers, //sets the values of the servers through what was stored in the returned dataSubject body
            ],
          },
        }),
          document.getElementById('closeModal').click();
        serverForm.resetForm({ status: this.Status.SERVER_DOWN });
        return {
          dataState: DataState.LOADED_STATE,
          appData: this.dataSubject.value,
        };
      }),
      startWith({
        dataState: DataState.LOADED_STATE,
        appData: this.dataSubject.value,
      }),
      catchError((error: string) => {
        this.notifer.onError(error);
        this.isLoading.next(false);
        return of({ dataState: DataState.ERROR, error });
      })
    );
  }

  filterServers(status: Status): void {
    this.appState$ = this.serverService
      .filter$(status, this.dataSubject.value)
      .pipe(
        map((response) => {
          this.notifer.onDefault(response.message);
          return { dataState: DataState.LOADED_STATE, appData: response };
        }),
        startWith({
          dataState: DataState.LOADED_STATE,
          appData: this.dataSubject.value,
        }),
        catchError((error: string) => {
          this.notifer.onError(error);
          return of({ dataState: DataState.ERROR, error });
        })
      );
  }

  deleteServer(server: Server): void {
    this.appState$ = this.serverService.delete$(server.id).pipe(
      map((response) => {
        this.notifer.onDefault(response.message);
        this.dataSubject.next({
          ...response,
          data: {
            servers: this.dataSubject.value.data.servers.filter(
              (s) => s.id !== server.id
            ),
          },
        });
        return {
          dataState: DataState.LOADED_STATE,
          appData: this.dataSubject.value,
        };
      }),
      startWith({
        dataState: DataState.LOADED_STATE,
        appData: this.dataSubject.value,
      }),
      catchError((error: string) => {
        this.notifer.onError(error);
        return of({ dataState: DataState.ERROR, error });
      })
    );
  }

  printReport(): void {
    //window.print() to print pdf
    this.notifer.onDefault('Report downloaded');
    let dataType = 'application/vnd.ms-excel.sheet.macroEnabled.12';
    let tableSelect = document.getElementById('servers');
    let tableHtml = tableSelect.outerHTML.replace(/ /g, '%20');
    let downloadLink = document.createElement('a');
    document.body.appendChild(downloadLink);
    downloadLink.href = 'data:' + dataType + ', ' + tableHtml;
    downloadLink.download = 'server-report.xls';
    downloadLink.click();
    document.body.removeChild(downloadLink);
  }
}
